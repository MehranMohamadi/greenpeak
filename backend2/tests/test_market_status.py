"""Synthetic, offline tests for the five live US500 status cards."""

import os
from copy import deepcopy
from datetime import UTC, datetime, timedelta
from unittest.mock import Mock

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

os.environ["DEBUG"] = "false"

from src.services import market_status as status
from src.api.v1.endpoints import analysis

NOW = datetime(2026, 10, 15, 18, tzinfo=UTC)


def prices(today_range=1.5, close=1001):
    days = []
    for offset in range(500, 0, -1):
        day = (NOW - timedelta(days=offset)).date()
        if day.weekday() < 5:
            days.append(day)
    history = [0.4 + (index % 100) / 40 for index in range(len(days))]
    timestamps = [int(datetime.combine(day, datetime.min.time(), tzinfo=status.NY).replace(hour=9, minute=30).timestamp()) for day in [*days, NOW.date()]]
    ranges = [*history, today_range]
    return {"chart": {"error": None, "result": [{
        "meta": {"symbol": "^GSPC", "regularMarketTime": int((NOW - timedelta(minutes=1)).timestamp()),
                 "currentTradingPeriod": {"regular": {"start": int(NOW.replace(hour=13, minute=30).timestamp()), "end": int(NOW.replace(hour=20).timestamp())}}},
        "timestamp": timestamps,
        "indicators": {"quote": [{"open": [1000] * len(timestamps), "high": [1000 + value * 5 for value in ranges],
                                   "low": [1000 - value * 5 for value in ranges], "close": [*([1000] * len(days)), close]}]},
    }]}}


def point(day, value):
    return {"date": day, "value": value}


@pytest.fixture
def inputs():
    yesterday = (NOW - timedelta(days=1)).date().isoformat()
    history = [point((NOW - timedelta(days=offset)).date().isoformat(), 10 + offset / 10) for offset in range(350, 1, -1)]
    return {
        "prices": prices(),
        "vix": {"series": {"vix": [*history, point(yesterday, 11)], "vix9d": [point(yesterday, 12)], "vix3m": [point(yesterday, 16)]},
                "metadata": {"source": "Cboe", "source_url": "https://example.com/cboe", "quality_status": "available", "frequency": "daily"}},
        "aaii": {"series": {"bullish": [point("2026-10-15", 50)], "neutral": [point("2026-10-15", 20)], "bearish": [point("2026-10-15", 30)]},
                 "metadata": {"source": "AAII", "observation_date": "2026-10-15", "quality_status": "available", "frequency": "weekly"}},
        "cftc": {"data": [point("2026-10-06", 100), point("2026-10-13", 200)],
                 "metadata": {"source": "CFTC", "observation_date": "2026-10-13", "quality_status": "available", "frequency": "weekly"}},
        "events": [],
    }


@pytest.fixture
def snapshot():
    return {"analysis_generated_at": (NOW - timedelta(hours=2)).isoformat(), "data_as_of": "2026-10-14",
            "coverage": {"status": "full", "ratio": 1, "available_count": 9, "configured_count": 9, "missing_inputs": []}}


@pytest.mark.parametrize("magnitude,expected", [(0.1, "low"), (1.6, "medium"), (5, "high")])
def test_intensity_is_classified_from_real_range_history(magnitude, expected):
    result, detail = status.daily_intensity(prices(magnitude, close=1000), NOW)
    assert result == expected
    assert detail.measurements["true_range_pct"] == pytest.approx(magnitude)
    assert detail.measurements["reference_count"] == 252
    assert detail.measurements["provisional"] is True


def test_intensity_does_not_depend_on_up_down_or_model_text(inputs, snapshot):
    first = status.build_market_status(snapshot, inputs, NOW)
    inputs["prices"] = prices(close=999)
    changed_text = {**snapshot, "current_analysis_fa": "متن کاملاً متفاوت",
                    "status_summary": {"change_intensity": "high", "confidence_level": "low", "sentiment": "risk_off"},
                    "warnings": ["متن هشدار مدل"]}
    second = status.build_market_status(changed_text, inputs, NOW)
    assert second.summary == first.summary


def test_true_range_includes_gap_from_previous_close():
    payload = prices()
    quote = payload["chart"]["result"][0]["indicators"]["quote"][0]
    for key, value in {"open": 1020, "high": 1025, "low": 1015, "close": 1020}.items():
        quote[key][-1] = value
    _, detail = status.daily_intensity(payload, NOW)
    assert detail.measurements["true_range_pct"] == pytest.approx(2.5)


def test_tercile_boundaries_are_reproducible_inclusive_and_exclude_current_value():
    history = list(range(1, 253))
    _, bounds = status._tercile(100, history)
    assert status._tercile(bounds["lower"], history)[0] == "low"
    assert status._tercile(bounds["upper"], history)[0] == "medium"
    assert status._tercile(bounds["upper"] + 0.001, history)[0] == "high"
    assert status._tercile(10, [1] * 252)[0] == "unknown"
    assert status._tercile(10, list(range(100)))[0] == "unknown"


@pytest.mark.parametrize("problem", ["missing", "short_history", "wrong_symbol", "stale", "future_quote", "malformed", "invalid_bar"])
def test_bad_or_insufficient_price_data_is_not_zero_filled(problem):
    payload = prices()
    result = payload["chart"]["result"][0]
    if problem == "missing": payload = None
    if problem == "short_history": result["timestamp"] = result["timestamp"][-5:]
    if problem == "wrong_symbol": result["meta"]["symbol"] = "^DJI"
    if problem == "stale": result["meta"]["regularMarketTime"] = int((NOW - timedelta(hours=1)).timestamp())
    if problem == "future_quote": result["meta"]["regularMarketTime"] = int((NOW + timedelta(hours=1)).timestamp())
    if problem == "malformed": payload = {"chart": {"result": None}}
    if problem == "invalid_bar": result["indicators"]["quote"][0]["low"][-1] = float("nan")
    assert status.daily_intensity(payload, NOW)[0] == "unknown"


def test_before_open_does_not_relabel_yesterday_as_today():
    state, detail = status.daily_intensity(prices(), NOW.replace(hour=12))
    assert state == "unknown"
    assert "امروز" in detail.explanation_fa


def test_end_of_session_requires_an_observation_near_the_close():
    assert status.daily_intensity(prices(), NOW.replace(hour=21))[0] == "unknown"
    payload = prices()
    payload["chart"]["result"][0]["meta"]["regularMarketTime"] = int(NOW.replace(hour=20, minute=0).timestamp())
    state, detail = status.daily_intensity(payload, NOW.replace(hour=21))
    assert state != "unknown" and detail.measurements["provisional"] is False


def test_sentiment_uses_two_weekly_sources_and_not_index_direction(inputs, snapshot):
    result = status.build_market_status(snapshot, inputs, NOW)
    assert result.summary.sentiment == "risk_on"
    inputs["prices"] = prices(close=999)
    assert status.build_market_status(snapshot, inputs, NOW).summary.sentiment == "risk_on"
    inputs["cftc"]["data"][-1]["value"] = 50
    assert status.build_market_status(snapshot, inputs, NOW).summary.sentiment == "neutral"
    inputs["aaii"]["series"]["bullish"][-1]["value"] = 30
    inputs["aaii"]["series"]["bearish"][-1]["value"] = 50
    assert status.build_market_status(snapshot, inputs, NOW).summary.sentiment == "risk_off"


@pytest.mark.parametrize("problem", ["missing", "old", "inconsistent_dates", "percentages", "future", "invalid_interval"])
def test_sentiment_quality_gates_do_not_invent_neutrality(inputs, snapshot, problem):
    if problem == "missing": inputs["aaii"] = None
    if problem == "old": inputs["cftc"]["data"][-1]["date"] = "2026-09-13"
    if problem == "inconsistent_dates": inputs["aaii"]["series"]["bullish"][-1]["date"] = "2026-10-14"
    if problem == "percentages": inputs["aaii"]["series"]["bullish"][-1]["value"] = 999
    if problem == "future": inputs["aaii"]["series"]["bullish"][-1]["date"] = "2026-10-16"
    if problem == "invalid_interval": inputs["cftc"]["data"][0]["date"] = "2026-10-12"
    assert status.build_market_status(snapshot, inputs, NOW).summary.sentiment == "unknown"


def test_risk_uses_volatility_term_structure_and_event_proximity_not_news_count(inputs, snapshot):
    assert status.build_market_status(snapshot, inputs, NOW).summary.risk_level == "low"
    event = {"title_fa": "رویداد آزمایشی", "release_at": (NOW + timedelta(hours=12)).isoformat(), "importance": "high"}
    inputs["events"] = [event]
    assert status.build_market_status(snapshot, inputs, NOW).summary.risk_level == "medium"
    inputs["events"] = [event] * 100
    assert status.build_market_status(snapshot, inputs, NOW).summary.risk_level == "medium"
    inputs["vix"]["series"]["vix9d"][-1]["value"] = 20
    assert status.build_market_status(snapshot, inputs, NOW).summary.risk_level == "high"


def test_high_risk_floor_is_preserved_when_another_input_is_missing(inputs, snapshot):
    inputs["vix"]["series"]["vix"][-1]["value"] = 60
    inputs["events"] = None
    data = status.build_market_status(snapshot, inputs, NOW)
    assert data.summary.risk_level == "high"
    assert data.summary.confidence_level == "low"


def test_missing_or_stale_volatility_and_calendar_cannot_establish_low_risk(inputs, snapshot):
    for key in ("vix", "events"):
        damaged = {**inputs, key: None}
        assert status.build_market_status(snapshot, damaged, NOW).summary.risk_level == "unknown"
    inputs["vix"]["series"]["vix3m"][-1]["date"] = "2026-09-01"
    assert status.build_market_status(snapshot, inputs, NOW).summary.risk_level == "unknown"


def test_confidence_tracks_data_quality_not_positive_predictions(inputs, snapshot):
    assert status.build_market_status(snapshot, inputs, NOW).summary.confidence_level == "high"
    partial = {**snapshot, "coverage": {"status": "provisional", "available_count": 2, "ratio": 0.2}}
    assert status.build_market_status(partial, inputs, NOW).summary.confidence_level == "medium"
    stale = {**snapshot, "analysis_generated_at": (NOW - timedelta(days=3)).isoformat()}
    assert status.build_market_status(stale, inputs, NOW).summary.confidence_level == "low"
    stale_sources = {**snapshot, "data_as_of": "2025-01-01"}
    assert status.build_market_status(stale_sources, inputs, NOW).summary.confidence_level == "low"
    inputs["aaii"]["metadata"]["quality_status"] = "stale"
    assert status.build_market_status(snapshot, inputs, NOW).summary.confidence_level == "medium"


def test_all_cards_have_methods_and_sources_and_do_not_mutate_inputs(inputs, snapshot):
    before = deepcopy(inputs)
    data = status.build_market_status(snapshot, inputs, NOW)
    assert data.summary.market_condition == "favorable"
    assert set(data.details) == set(data.summary.model_dump())
    assert all(detail.method_fa and detail.sources for detail in data.details.values())
    assert before == inputs
    missing = status.build_market_status(None, {}, NOW)
    assert missing.summary.change_intensity == "unknown"
    assert missing.summary.confidence_level == "low"


def test_status_endpoint_is_read_only_and_survives_missing_stored_analysis(monkeypatch, inputs):
    from src.main import app
    latest = Mock(side_effect=HTTPException(503, "not returned to user"))
    monkeypatch.setattr(analysis, "_latest", latest)
    monkeypatch.setattr(analysis, "current_market_status", lambda snapshot: status.build_market_status(snapshot, inputs, NOW))
    client = TestClient(app)
    response = client.get("/api/v1/market/status-summary")
    assert response.status_code == 200
    body = response.json()
    assert body["data"]["summary"]["confidence_level"] == "low"
    assert body["data"]["summary"]["change_intensity"] != "unknown"
    assert "not returned" not in response.text
    assert response.headers["cache-control"] == "no-store"
    assert client.get("/health").status_code == 200


def test_cached_reads_do_not_repeat_upstreams_within_a_refresh_bucket(monkeypatch, inputs):
    status._cached_inputs.cache_clear()
    price = Mock(return_value=inputs["prices"])
    official = Mock(side_effect=lambda key: inputs[{"vix_term_structure": "vix", "aaii_bull_bear_spread": "aaii", "cftc_sp500_positioning": "cftc"}[key]])
    monkeypatch.setattr(status, "_fetch_prices", price)
    monkeypatch.setattr(status.official_sentiment_service, "get", official)
    monkeypatch.setattr(status, "fetch_upcoming_us_events", Mock(return_value=[]))
    try:
        assert status._cached_inputs(1) == status._cached_inputs(1)
        assert price.call_count == 1 and official.call_count == 3
        status._cached_inputs(2)
        assert price.call_count == 2 and official.call_count == 6
    finally:
        status._cached_inputs.cache_clear()
