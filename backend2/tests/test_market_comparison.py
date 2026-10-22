from datetime import UTC, date, datetime, timedelta
import json
from unittest.mock import Mock

from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest
import requests

from src.api.v1.endpoints import market_comparison as endpoint
from src.models.market_comparison import ComparisonRequest
from src.services.market_comparison.engine import build_comparison, period_start
from src.services.market_comparison.providers import DailyMarketStore, SourceUnavailable, clean_points, parse_fred_csv, parse_navasan, parse_tsetmc, parse_yahoo
from src.services.market_comparison.service import MarketComparisonService

TODAY = date(2026, 10, 22)
NOW = datetime(2026, 10, 22, 12, tzinfo=UTC)


def source(values, days=None, **extra):
    days = days or [(TODAY - timedelta(days=len(values) - index)).isoformat() for index in range(len(values))]
    return {"data": [{"date": day, "value": value} for day, value in zip(days, values)],
        "source": "test fixture", "source_url": "https://example.test", "retrieved_at": NOW.isoformat(), **extra}


def compare(symbols, sources, **kwargs):
    fx = kwargs.pop("fx", None)
    return build_comparison(ComparisonRequest(symbols=symbols, **kwargs), sources, today=TODAY, fx=fx)


def test_common_dates_and_base_100_do_not_forward_fill():
    values = {"sp500": source([99, 100, 110], ["2026-10-18", "2026-10-19", "2026-10-21"]),
              "gold": source([200, 800, 220], ["2026-10-19", "2026-10-20", "2026-10-21"])}
    result = compare(["sp500", "gold"], values)
    assert result.start_date == "2026-10-19"
    assert result.common_observations == 2
    assert [point.value for point in result.series[0].data] == pytest.approx([100, 110])
    assert [point.value for point in result.series[1].data] == pytest.approx([100, 110])
    assert result.series[0].change_pct == pytest.approx(10)
    assert "2026-10-19" in result.summary_fa


def test_correlation_uses_changes_not_levels():
    left, right = [100.0], [200.0]
    for index in range(24):
        change = 0.01 if index % 2 else -0.02
        left.append(left[-1] * (1 + change))
        right.append(right[-1] * (1 - change * 2))
    result = compare(["sp500", "gold"], {"sp500": source(left), "gold": source(right)}, view="relationship")
    assert result.correlation == pytest.approx(-1)
    assert result.correlation_samples == 24


@pytest.mark.parametrize("symbols,expected_x,expected_y", [
    (["sp500", "gold"], [200, 220], [100, 110]),
    (["gold", "sp500"], [100, 110], [200, 220]),
])
def test_xy_plot_places_first_symbol_on_y_and_second_on_x_on_common_dates(symbols, expected_x, expected_y):
    sources = {"sp500": source([99, 100, 110], ["2026-10-18", "2026-10-19", "2026-10-21"]),
               "gold": source([200, 800, 220], ["2026-10-19", "2026-10-20", "2026-10-21"])}
    result = compare(symbols, sources, view="relationship")
    plot = result.relationship
    assert plot.x_axis.symbol_id == symbols[1]
    assert plot.y_axis.symbol_id == symbols[0]
    assert [point.date for point in plot.points] == ["2026-10-19", "2026-10-21"]
    assert [point.x for point in plot.points] == expected_x
    assert [point.y for point in plot.points] == expected_y
    assert plot.x_axis.currency == plot.y_axis.currency == "USD"
    assert compare(symbols, sources).relationship is None


def test_xy_rate_axis_keeps_percent_values_including_negative_and_zero():
    result = compare(["gold", "real_yield_10y"], {"gold": source([2000, 2100, 2200]), "real_yield_10y": source([-0.5, 0, 0.25])}, view="relationship")
    plot = result.relationship
    assert [point.x for point in plot.points] == [-0.5, 0, 0.25]
    assert [point.y for point in plot.points] == [2000, 2100, 2200]
    assert plot.x_axis.unit == "درصد سالانه"
    assert plot.x_axis.currency is None


def test_xy_values_use_same_day_fx_and_report_converted_axis_units():
    fx = source([1000, 2000], unit="IRR_per_USD")
    result = compare(["gold", "sp500"], {"gold": source([100, 110]), "sp500": source([1000, 1100])}, view="relationship", currency="IRR", fx=fx)
    plot = result.relationship
    assert [point.y for point in plot.points] == [100000, 220000]
    assert [point.x for point in plot.points] == [1000000, 2200000]
    assert plot.y_axis.unit == "ریال / اونس تروا"
    assert plot.x_axis.currency == plot.y_axis.currency == "IRR"


def test_rate_keeps_negative_percent_and_uses_bp_not_percent_returns():
    result = compare(["gold", "real_yield_10y"], {"gold": source([100, 110, 120]), "real_yield_10y": source([-0.5, 0, 0.25])}, view="relationship")
    rate = result.series[1]
    assert [point.value for point in rate.data] == [-0.5, 0, 0.25]
    assert rate.change_bp == 75
    assert rate.change_pct is None
    assert "real_yield_10y" not in result.ranking
    assert result.correlation is None
    assert result.correlation_reason


@pytest.mark.parametrize("values", [[100] * 25, [100, 0, *([100] * 23)], [100, -2, *([100] * 23)]])
def test_constant_or_nonpositive_returns_never_produce_correlation(values):
    result = compare(["sp500", "wti"], {"sp500": source(list(range(100, 125))), "wti": source(values)}, view="relationship")
    assert result.correlation is None
    assert result.correlation_reason


def test_dividend_basis_cannot_be_mixed_even_with_currency_conversion():
    result = compare(["iran_total", "gold"], {"iran_total": source([100, 110]), "gold": source([100, 110])})
    assert result.status == "incompatible"
    assert not result.ranking
    assert not any(item.data for item in result.series)
    assert "سود نقدی" in result.summary_fa


def test_iran_total_and_equal_weight_can_be_compared_on_rial_total_return_basis():
    result = compare(["iran_total", "iran_equal"], {"iran_total": source([100, 110]), "iran_equal": source([100, 105])}, currency="IRR", view="relationship")
    assert result.status == "available"
    assert result.ranking == ["iran_total", "iran_equal"]


def test_cross_currency_requires_verified_fx_history():
    result = compare(["iran_price", "gold"], {"iran_price": source([100, 220]), "gold": source([100, 110])})
    assert result.status == "incompatible"
    assert not any(item.data for item in result.series)


def test_same_date_fx_conversion_changes_relative_performance():
    fx = source([1000, 2000], unit="IRR_per_USD")
    result = compare(["iran_price", "gold"], {"iran_price": source([100, 220]), "gold": source([100, 110])}, fx=fx)
    assert result.status == "available"
    assert result.series[0].change_pct == pytest.approx(10)
    assert result.series[1].change_pct == pytest.approx(10)
    assert result.fx_source == "test fixture"


def test_fx_dates_are_intersected_without_carrying_rates_forward():
    fx = source([1000, 2000], ["2026-10-19", "2026-10-21"], unit="IRR_per_USD")
    result = compare(["iran_price", "gold"], {"iran_price": source([100, 900, 220]), "gold": source([100, 400, 110])}, fx=fx)
    assert result.common_observations == 2
    assert [point.date for point in result.series[0].data] == ["2026-10-19", "2026-10-21"]


def test_missing_selection_is_explicit_and_has_no_ranking():
    result = compare(["sp500", "gold"], {"sp500": source([100, 110]), "gold": None})
    assert result.status == "partial"
    assert result.series[1].status == "unavailable"
    assert result.series[1].change_pct is None
    assert result.ranking == []
    pair = compare(["sp500", "gold"], {"sp500": source([100, 110]), "gold": None}, view="relationship")
    assert pair.status == "unavailable"
    assert pair.correlation is None
    assert pair.relationship is None


def test_old_data_stays_stale_and_selection_window_is_not_anchored_to_old_data():
    result = compare(["sp500"], {"sp500": source([100, 110], ["2020-01-01", "2020-01-02"])}, period="1M")
    assert result.status == "unavailable"
    assert not result.series[0].data
    assert any("قدیمی" in warning for warning in result.warnings)
    assert period_start(date(2024, 3, 31), "1M") == date(2024, 2, 29)


def test_tsetmc_identity_cleaning_and_duplicates():
    payload = {"indexB2": [{"insCode": 32097828799138957, "dEven": 20261021, "xNivInuClMresIbs": 125.5}]}
    points, invalid, duplicates = parse_tsetmc(payload, "32097828799138957", today=TODAY)
    assert points == [{"date": "2026-10-21", "value": 125.5}]
    with pytest.raises(SourceUnavailable, match="identity"):
        parse_tsetmc(payload, "67130298613737946")
    clean, invalid, duplicates = clean_points([{ "date": "2026-10-21", "value": value} for value in [0, 0, None, True, float("nan")]])
    assert clean == [{"date": "2026-10-21", "value": 0}]
    assert (invalid, duplicates) == (3, 1)
    with pytest.raises(SourceUnavailable, match="conflicting"):
        clean_points([{"date": "2026-10-21", "value": 1}, {"date": "2026-10-21", "value": 2}])


def test_fred_requires_exact_series_and_does_not_turn_missing_into_zero():
    points, invalid, _ = parse_fred_csv("observation_date,DFII10\n2026-10-20,-0.5\n2026-10-21,.\n", "DFII10", today=TODAY)
    assert points == [{"date": "2026-10-20", "value": -0.5}]
    assert invalid == 1
    with pytest.raises(SourceUnavailable, match="identity"):
        parse_fred_csv("observation_date,DGS10\n2026-10-20,4.5", "DFII10")


def test_yahoo_rejects_source_substitution_and_omits_unfinished_day():
    timestamps = [int(datetime(2026, 10, day, 14, tzinfo=UTC).timestamp()) for day in [21, 22]]
    payload = {"chart": {"result": [{"meta": {"symbol": "GC=F", "dataGranularity": "1d", "currency": "USD", "exchangeTimezoneName": "America/New_York"}, "timestamp": timestamps, "indicators": {"quote": [{"close": [2000, 2010]}]}}]}}
    points, _, _ = parse_yahoo(payload, "GC=F", now=NOW)
    assert len(points) == 1
    with pytest.raises(SourceUnavailable, match="mismatch"):
        parse_yahoo(payload, "SI=F", now=NOW)


def test_navasan_requires_explicit_unit_and_converts_toman_to_rial():
    payload = [{"timestamp": int(NOW.timestamp()), "close": "100000"}]
    assert parse_navasan(payload, "IRT", today=TODAY)[0][0]["value"] == 1000000
    with pytest.raises(SourceUnavailable):
        parse_navasan(payload, "")


def test_server_cache_is_persistent_and_old_data_is_marked_after_upstream_failure(tmp_path):
    request = Mock()
    store = DailyMarketStore(tmp_path, request=request, now=lambda: NOW)
    value = {"version": 1, "source_series_id": "^GSPC", **source([100, 110])}
    store._fetch = Mock(return_value=value)
    first = store.load("sp500")
    assert first["cache_stale"] is False
    store2 = DailyMarketStore(tmp_path, request=request, now=lambda: NOW)
    assert store2.load("sp500")["data"] == first["data"]
    request.assert_not_called()
    later = DailyMarketStore(tmp_path, now=lambda: NOW + timedelta(days=2))
    later._fetch = Mock(side_effect=requests.RequestException("sensitive provider exception"))
    assert later.load("sp500")["cache_stale"] is True
    assert "sensitive" not in str(later.load("gold"))


def test_catalog_disables_iran_gold_until_verified_fx_and_distinguishes_dollar_index(tmp_path):
    catalog = MarketComparisonService(DailyMarketStore(tmp_path)).catalog()
    assert not next(preset for preset in catalog["presets"] if preset["id"] == "iran_gold")["enabled"]
    assert next(symbol for symbol in catalog["symbols"] if symbol["id"] == "broad_dollar")["series"] == "DTWEXBGS"


def packaged_history(directory, key="iran_total", series_id="32097828799138957"):
    directory.mkdir(parents=True, exist_ok=True)
    value = {"version": 1, "source_series_id": series_id, **source([100, 110])}
    (directory / f"{key}.json").write_text(json.dumps(value), encoding="utf-8")
    return value


def test_packaged_index_history_is_stale_and_retries_after_cooldown(tmp_path):
    fallback = tmp_path / "packaged"
    value = packaged_history(fallback)
    current = [NOW]
    store = DailyMarketStore(tmp_path / "runtime", fallback_directory=fallback, now=lambda: current[0])
    store._fetch = Mock(side_effect=requests.RequestException("provider unavailable"))
    result = store.load("iran_total")
    assert result["data"] == value["data"]
    assert result["retrieved_at"] == value["retrieved_at"]
    assert result["cache_stale"] is result["packaged_snapshot"] is True
    assert not (tmp_path / "runtime" / "iran_total.json").exists()
    assert store.load("iran_total") == result
    assert store._fetch.call_count == 1
    store.load("iran_total", force=True)
    assert store._fetch.call_count == 2
    current[0] += timedelta(minutes=6)
    store.load("iran_total")
    assert store._fetch.call_count == 3


def test_live_index_history_takes_precedence_and_persists(tmp_path):
    fallback = tmp_path / "packaged"
    packaged_history(fallback)
    live = {"version": 1, "source_series_id": "32097828799138957", **source([120, 130])}
    store = DailyMarketStore(tmp_path / "runtime", fallback_directory=fallback, now=lambda: NOW)
    store._fetch = Mock(return_value=live)
    result = store.load("iran_total")
    assert result["data"] == live["data"]
    assert result["cache_stale"] is False
    assert not result.get("packaged_snapshot")
    assert store.load("iran_total") == result
    store._fetch.assert_called_once()


@pytest.mark.parametrize("key,series_id", [("iran_total", "wrong-series"), ("sp500", "^GSPC"), ("usdirr", "usd_sell")])
def test_packaged_fallback_rejects_wrong_identity_and_non_tsetmc_symbols(tmp_path, key, series_id):
    fallback = tmp_path / "packaged"
    packaged_history(fallback, key, series_id)
    store = DailyMarketStore(tmp_path / "runtime", fallback_directory=fallback, now=lambda: NOW)
    store._fetch = Mock(side_effect=requests.RequestException("unavailable"))
    assert store.load(key) is None


def test_packaged_index_comparison_preserves_values_dates_and_explicit_warning():
    result = compare(["iran_total", "iran_equal"], {
        "iran_total": source([100, 110], cache_stale=True, packaged_snapshot=True),
        "iran_equal": source([200, 210], cache_stale=True, packaged_snapshot=True),
    }, currency="IRR", view="relationship")
    assert result.status == "available"
    assert all(item.status == "stale" for item in result.series)
    assert [point.x for point in result.relationship.points] == [200, 210]
    assert [point.y for point in result.relationship.points] == [100, 110]
    assert sum("TSETMC" in warning and NOW.date().isoformat() in warning for warning in result.warnings) == 2


def test_api_contract_and_whitelist(monkeypatch, tmp_path):
    store = DailyMarketStore(tmp_path, now=lambda: NOW)
    store.load_many = Mock(return_value={"sp500": source([100, 110]), "gold": source([100, 120])})
    monkeypatch.setattr(endpoint, "get_comparison_service", lambda: MarketComparisonService(store))
    app = FastAPI()
    app.include_router(endpoint.router, prefix="/api/v1")
    client = TestClient(app)
    assert client.get("/api/v1/market-comparison/symbols").status_code == 200
    response = client.post("/api/v1/market-comparison/compare", json={"symbols": ["sp500", "gold"]})
    assert response.status_code == 200
    assert response.json()["series"][0]["data"][0]["value"] == 100
    pair = client.post("/api/v1/market-comparison/compare", json={"symbols": ["sp500", "gold"], "view": "relationship"})
    assert pair.status_code == 200
    assert pair.json()["schema_version"] == "1.1.0"
    assert pair.json()["relationship"]["x_axis"]["symbol_id"] == "gold"
    assert pair.json()["relationship"]["points"][-1]["x"] == 120
    assert pair.json()["relationship"]["points"][-1]["y"] == 110
    for selection in [{"symbols": ["../secret"]}, {"symbols": ["gold", "gold"]}, {"symbols": ["gold"], "view": "relationship"}, {"symbols": ["gold"], "period": "bad"}]:
        assert client.post("/api/v1/market-comparison/compare", json=selection).status_code == 422
