"""Offline leverage math and authenticated dashboard contract checks."""

from copy import deepcopy

import pytest
from fastapi.testclient import TestClient
from pymongo.errors import PyMongoError

from src.api.v1.endpoints.auth import require_user
from src.api.v1.endpoints.mt5 import snapshot_service
from src.main import app
from src.models.mt5_schemas import MT5Snapshot
from src.services.mt5_risk_service import account_leverage, build_risk_overview


def snapshot(equity=10_000, gross=60_000, currency="USD", identifier="account-1"):
    return MT5Snapshot.model_validate({
        "schema_version": "1.0", "snapshot_id": f"snapshot-{identifier}",
        "timestamp_utc": "2026-10-28T10:00:00Z",
        "source": {
            "ea_name": "Test EA", "ea_version": "1.04", "broker_company": "Test Broker",
            "trade_server": "Test Server", "account_identifier": identifier, "send_mode": "manual",
        },
        "account": {
            "currency": currency, "balance": 10_000, "equity": equity, "used_margin": 100,
            "free_margin": 9_900, "floating_profit_loss": 0,
        },
        "portfolio_metrics": {"gross_portfolio_exposure_usd": gross, "gross_portfolio_leverage": 0},
        "positions": [{"symbol": "XAUUSD", "direction": "BUY", "volume": 1}],
    })


def test_recomputes_leverage_without_using_reported_leverage_or_mutating_raw():
    raw = snapshot()
    before = deepcopy(raw.model_dump())
    result = account_leverage(raw)
    assert result.value == 6
    assert result.exposure_source == "symbol_net"
    assert raw.model_dump() == before
    raw.portfolio_metrics.gross_portfolio_leverage = 999
    assert account_leverage(raw).value == 6


def test_equal_opposing_positions_net_to_zero():
    raw = snapshot(gross=0)
    raw.positions.append({"symbol": "XAUUSD", "direction": "SELL", "volume": 1})
    raw.symbol_metrics = [{"symbol": "XAUUSD", "long_symbol_notional_usd": 60_000, "short_symbol_notional_usd": 60_000}]
    result = account_leverage(raw)
    assert result.value == 0
    assert result.gross_exposure_usd == 0
    assert result.exposure_source == "symbol_net"


def test_multiple_symbols_sum_absolute_nets_at_full_precision():
    raw = snapshot(equity=3, gross=0)
    raw.positions.append({"symbol": "US500.cash", "direction": "SELL", "volume": 1})
    raw.symbol_metrics = [
        {"symbol": "XAUUSD", "long_symbol_notional_usd": 1, "short_symbol_notional_usd": 0},
        {"symbol": "US500.cash", "long_symbol_notional_usd": 0, "short_symbol_notional_usd": 3},
    ]
    assert account_leverage(raw).value == 4 / 3


def test_legacy_hedged_portfolio_can_supply_account_total_but_not_missing_symbol_details():
    raw = snapshot()
    raw.positions.append({"symbol": "XAUUSD", "direction": "SELL", "volume": 0.5})
    result = account_leverage(raw)
    assert result.value == 6
    assert result.exposure_source == "portfolio_exposure"
    assert build_risk_overview([raw]).leverage.reason == "incomplete_accounts"


@pytest.mark.parametrize("gross", [None, 0, -1, float("nan"), float("inf")])
def test_unknown_or_invalid_exposure_with_positions_never_becomes_zero(gross):
    result = account_leverage(snapshot(gross=gross))
    assert result.value is None
    assert result.reason == "missing_exposure"


@pytest.mark.parametrize("equity,reason", [(0, "non_positive_equity"), (-100, "non_positive_equity"), (float("nan"), "missing_equity")])
def test_invalid_equity_stays_unavailable(equity, reason):
    result = account_leverage(snapshot(equity=equity))
    assert result.value is None
    assert result.reason == reason


def test_currency_and_failed_conversion_are_explicit():
    assert account_leverage(snapshot(currency="EUR")).reason == "unsupported_currency"
    raw = snapshot()
    raw.calculation_status["active_symbol"] = "USD_CONVERSION_UNAVAILABLE"
    assert account_leverage(raw).value is None


def test_zero_is_valid_only_when_no_positions_exist():
    raw = snapshot(gross=0)
    raw.positions = []
    result = account_leverage(raw)
    assert result.value == 0
    assert result.exposure_source == "no_positions"
    raw.portfolio_metrics.gross_portfolio_exposure_usd = 60_000
    assert account_leverage(raw).reason == "inconsistent_positions"


def test_malformed_positions_and_incomplete_symbol_data_cannot_hide_hedges():
    raw = snapshot()
    raw.positions[0]["direction"] = "unknown"
    assert account_leverage(raw).reason == "incomplete_positions"
    raw = snapshot(gross=0)
    raw.symbol_metrics = [{"symbol": "XAUUSD", "long_symbol_notional_usd": 0, "short_symbol_notional_usd": 0}]
    assert account_leverage(raw).value is None


def test_aggregate_is_ratio_of_sums_and_preserves_individual_high_leverage():
    result = build_risk_overview([snapshot(100, 5_000), snapshot(9_900, 5_000, identifier="account-2")])
    assert result.leverage.value == 1
    assert result.accounts[0].leverage.value == 50
    assert result.leverage.equity_usd == 10_000
    assert result.leverage.gross_exposure_usd == 10_000


def test_aggregate_does_not_drop_missing_inputs_or_negative_equity_accounts():
    assert build_risk_overview([]).leverage.reason == "no_accounts"
    assert build_risk_overview([snapshot(), snapshot(gross=None)]).leverage.reason == "incomplete_accounts"
    assert build_risk_overview([snapshot(), snapshot(currency="EUR")]).leverage.value is None
    negative = build_risk_overview([snapshot(-100, 5_000), snapshot(9_900, 5_000)])
    assert negative.leverage.value == 10_000 / 9_800
    assert negative.accounts[0].leverage.reason == "non_positive_equity"
    assert build_risk_overview([snapshot(0)]).leverage.reason == "non_positive_equity"


def test_numeric_overflow_never_reaches_json():
    assert account_leverage(snapshot(equity=1e-300, gross=1e300)).reason == "invalid_result"
    result = build_risk_overview([snapshot(gross=1e308), snapshot(gross=1e308)])
    assert result.leverage.value is None
    assert result.leverage.reason == "invalid_result"


def test_same_symbol_nets_across_brokers_and_aliases_but_other_symbols_do_not():
    first = snapshot(10_000, 60_000)
    second = snapshot(10_000, 60_000, identifier="account-2")
    second.positions[0].update(symbol="GOLD.pro", direction="SELL")
    result = build_risk_overview([first, second])
    assert result.leverage.value == 0
    assert result.leverage.gross_exposure_usd == 0
    assert result.accounts[0].leverage.value == 6
    assert result.accounts[1].leverage.value == 6
    assert result.symbol_risks[0].net_exposure_usd == 0
    assert result.symbol_risks[0].target_reason == "net_zero"
    second.positions[0]["symbol"] = "US500.cash"
    distinct = build_risk_overview([first, second])
    assert distinct.leverage.gross_exposure_usd == 120_000
    assert distinct.leverage.value == 6
    assert len(distinct.symbol_risks) == 2


def test_partial_hedge_uses_net_exposure_and_preserves_raw():
    raw = snapshot(10_000, 50_000)
    raw.positions.append({"symbol": "XAUUSD", "direction": "SELL", "volume": 0.5})
    raw.symbol_metrics = [{"symbol": "XAUUSD", "long_symbol_notional_usd": 100_000, "short_symbol_notional_usd": 50_000}]
    before = deepcopy(raw.model_dump())
    result = build_risk_overview([raw])
    assert result.leverage.value == 5
    assert result.symbol_risks[0].net_exposure_usd == 50_000
    assert raw.model_dump() == before


@pytest.mark.parametrize("direction,expected", [("BUY", 100 * 8 / 18), ("SELL", 100 * 8 / 22)])
def test_price_stress_reaches_symbol_leverage_ten_with_changing_exposure_and_equity(direction, expected):
    raw = snapshot(10_000, 20_000)
    raw.positions[0]["direction"] = direction
    row = build_risk_overview([raw]).symbol_risks[0]
    assert row.leverage == 2
    assert row.adverse_direction == ("fall" if direction == "BUY" else "rise")
    assert row.adverse_move_pct == pytest.approx(expected)
    move = row.adverse_move_pct / 100 * (-1 if direction == "BUY" else 1)
    net = row.net_exposure_usd
    assert abs(net * (1 + move)) / (10_000 + net * move) == pytest.approx(10)


def test_stress_handles_unreachable_already_reached_and_missing_data():
    below_one = build_risk_overview([snapshot(10_000, 5_000)]).symbol_risks[0]
    assert below_one.adverse_move_pct is None
    assert below_one.target_reason == "no_positive_price_solution"
    at_one = build_risk_overview([snapshot(10_000, 10_000)]).symbol_risks[0]
    assert at_one.target_reason == "no_positive_price_solution"
    above = build_risk_overview([snapshot(10_000, 110_000)]).symbol_risks[0]
    assert above.adverse_move_pct == 0 and above.target_reason == "already_at_target"
    non_usd = build_risk_overview([snapshot(currency="EUR")]).symbol_risks[0]
    assert non_usd.adverse_move_pct is None and non_usd.leverage is None


def test_cross_account_stress_uses_combined_equity_and_net_direction():
    long = snapshot(10_000, 100_000)
    short = snapshot(10_000, 60_000, identifier="account-2")
    short.positions[0]["direction"] = "SELL"
    result = build_risk_overview([long, short])
    assert result.leverage.value == 2
    assert result.symbol_risks[0].leverage == 2
    assert result.symbol_risks[0].adverse_move_pct == pytest.approx(100 * 8 / 18)
    assert result.accounts[0].leverage.value == 10
    assert result.accounts[1].leverage.value == 6


def test_all_open_symbols_can_be_valued_from_usd_tick_observations_without_active_chart_metrics():
    raw = snapshot(gross=0)
    raw.positions = [
        {"symbol": "XAUUSD", "direction": "BUY", "volume": 0.1},
        {"symbol": "US500.cash", "direction": "SELL", "volume": 1},
    ]
    raw.broker_symbol_data = [
        {"symbol": "XAUUSD", "trade_calculation_mode": 2, "tick_size": 0.01, "tick_value": 1, "bid": 2499, "ask": 2501},
        {"symbol": "US500.cash", "trade_calculation_mode": 3, "tick_size": 0.1, "tick_value": 0.1, "bid": 4999, "ask": 5001},
    ]
    result = build_risk_overview([raw])
    nets = {row.symbol_id: row.net_exposure_usd for row in result.symbol_risks}
    assert nets == {"gold": 25_000, "sp500": -5_000}
    assert result.leverage.value == 3
    assert all(row.leverage is not None for row in result.symbol_risks)


def test_equal_decimal_lots_cancel_before_using_bid_ask_and_without_fx_guessing():
    raw = snapshot(gross=123)
    raw.positions = [
        {"symbol": "XAUUSD", "direction": "BUY", "volume": 0.1},
        {"symbol": "XAUUSD", "direction": "BUY", "volume": 0.2},
        {"symbol": "XAUUSD", "direction": "SELL", "volume": 0.3},
    ]
    result = build_risk_overview([raw])
    assert result.leverage.value == 0
    assert result.symbol_risks[0].target_reason == "net_zero"


@pytest.mark.parametrize("mode", [35, 37, 64, None, "OPTIONS"])
def test_tick_valuation_does_not_guess_for_unsupported_contract_types(mode):
    raw = snapshot(gross=None)
    raw.broker_symbol_data = [{"symbol": "XAUUSD", "trade_calculation_mode": mode, "tick_size": 0.01, "tick_value": 1, "bid": 2500, "ask": 2501}]
    assert account_leverage(raw).value is None


def test_risk_endpoint_requires_authentication():
    assert TestClient(app).get("/api/v1/mt5/risk-overview").status_code == 401


def test_risk_endpoint_is_owner_scoped_sanitized_and_health_still_works():
    raw = snapshot().model_dump(mode="python")
    raw["owner_user_id"] = "private-owner"
    raw["connection_id"] = "private-connection"
    raw["leverage"] = {"value": 999}  # Never trust an uploaded analytical field.
    calls = []

    class MemoryService:
        def latest_by_account(self, owner):
            calls.append(owner)
            return [raw]

    app.dependency_overrides[require_user] = lambda: {"id": "current-user", "role": "user"}
    app.dependency_overrides[snapshot_service] = lambda: MemoryService()
    try:
        client = TestClient(app)
        response = client.get("/api/v1/mt5/risk-overview")
        assert client.get("/health").status_code == 200
        assert client.get("/api/v1/system/health").status_code == 200
    finally:
        app.dependency_overrides.clear()
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert calls == ["current-user"]
    body = response.json()
    assert body["accounts"][0]["leverage"]["value"] == 6
    assert body["leverage"]["value"] == 6
    assert set(body["accounts"][0]["source"]) == {"broker_company", "trade_server", "account_identifier"}
    assert "private-owner" not in response.text and "private-connection" not in response.text
    assert raw["leverage"]["value"] == 999


def test_storage_errors_are_sanitized():
    class FailedService:
        def latest_by_account(self, owner):
            raise PyMongoError("secret connection details")

    app.dependency_overrides[require_user] = lambda: {"id": "user", "role": "user"}
    app.dependency_overrides[snapshot_service] = lambda: FailedService()
    try:
        response = TestClient(app).get("/api/v1/mt5/risk-overview")
    finally:
        app.dependency_overrides.clear()
    assert response.status_code == 503
    assert "secret" not in response.text
