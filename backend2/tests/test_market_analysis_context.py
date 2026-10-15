import os
from datetime import UTC, date, datetime

import httpx
import pytest
from unittest.mock import Mock

os.environ["DEBUG"] = "false"

from src.services import market_analysis_context as context
from src.services.market_analysis_context import parse_sp500_session_move


def _payload():
    timestamps = [
        int(datetime(2026, 9, 23, 19, 55, tzinfo=UTC).timestamp()),
        int(datetime(2026, 9, 24, 19, 55, tzinfo=UTC).timestamp()),
        int(datetime(2026, 9, 25, 13, 35, tzinfo=UTC).timestamp()),
        int(datetime(2026, 9, 25, 19, 30, tzinfo=UTC).timestamp()),
    ]
    return {
        "chart": {
            "error": None,
            "result": [{
                "timestamp": timestamps,
                "indicators": {"quote": [{
                    "open": [6500, 6510, 6525, 6525],
                    "close": [6510, 6520, 6526, 6585.2],
                }]},
            }],
        },
    }


def test_late_session_uses_todays_sp500_move():
    result = parse_sp500_session_move(
        _payload(),
        datetime(2026, 9, 25, 19, 30, tzinfo=UTC),
    )

    assert result["session_scope"] == "today_late_or_closed"
    assert result["session_date"] == "2026-09-25"
    assert result["previous_close"] == 6520
    assert result["direction"] == "up"
    assert result["change_pct"] == 1.0
    assert result["current_session"]["session_status"] == "in_progress"
    assert result["latest_completed_session"]["session_date"] == "2026-09-24"


def test_early_session_uses_previous_completed_sp500_session():
    result = parse_sp500_session_move(
        _payload(),
        datetime(2026, 9, 25, 14, 0, tzinfo=UTC),
    )

    assert result["session_scope"] == "previous_completed_session"
    assert result["session_date"] == "2026-09-24"
    assert result["previous_session_date"] == "2026-09-23"
    assert result["current_session"]["session_date"] == "2026-09-25"
    assert result["current_session"]["close_or_latest"] == 6526
    assert result["current_session"]["session_status"] == "in_progress"
    assert result["latest_completed_session"]["session_date"] == "2026-09-24"


def test_completed_session_is_distinct_from_intraday_observation():
    result = parse_sp500_session_move(_payload(), datetime(2026, 9, 25, 21, tzinfo=UTC))
    assert result["current_session"]["session_status"] == "completed"
    assert result["latest_completed_session"]["session_date"] == "2026-09-25"
    assert result["latest_completed_session"]["change_pct"] == 1.0


@pytest.mark.parametrize("now", [
    datetime(2026, 9, 25, 12, tzinfo=UTC),  # Before Friday's open.
    datetime(2026, 9, 26, 17, tzinfo=UTC),  # Saturday, no current session.
])
def test_no_today_move_is_invented_outside_observed_sessions(now):
    result = parse_sp500_session_move(_payload(), now)
    assert result["current_session"] is None
    expected_date = "2026-09-24" if now.day == 25 else "2026-09-25"
    assert result["latest_completed_session"]["session_date"] == expected_date


def test_missing_previous_close_does_not_fabricate_a_move():
    payload = _payload()
    payload["chart"]["result"][0]["timestamp"] = payload["chart"]["result"][0]["timestamp"][:1]
    with pytest.raises(ValueError, match="Insufficient"):
        parse_sp500_session_move(payload, datetime(2026, 9, 25, 21, tzinfo=UTC))


def test_flow_reuses_published_and_upcoming_calendar_services(monkeypatch):
    now = datetime(2026, 9, 25, 14, tzinfo=UTC)
    move = {"session_date": "2026-09-24", "current_session": {"session_date": "2026-09-25"}}
    released = [{"event_id": "released", "actual": "2.1%", "forecast": "2.2%", "release_at": "2026-09-25T12:30:00+00:00"}]
    upcoming = [{"event_id": "future", "actual": None, "release_at": "2026-09-28T12:30:00+00:00"}]
    fetch_move = Mock(return_value=move)
    fetch_released = Mock(return_value=released)
    fetch_upcoming = Mock(return_value=upcoming)
    monkeypatch.setattr(context, "fetch_sp500_session_move", fetch_move)
    monkeypatch.setattr(context, "fetch_recent_us_events", fetch_released)
    monkeypatch.setattr(context, "fetch_upcoming_us_events", fetch_upcoming)
    monkeypatch.setattr(context, "_recent_news", lambda *args: [{"item_id": "earnings-news", "tickers": ["TEST"]}])

    result = context.build_market_analysis_context(object(), "test", now.date(), now)
    assert result["sp500_session_move"] == move
    assert result["current_market_context"] == {"released_us_events": released, "warnings": []}
    assert result["upcoming_us_events"] == upcoming
    assert result["recent_market_news"][0]["tickers"] == ["TEST"]
    assert result["warnings"] == []
    fetch_move.assert_called_once_with(now)
    fetch_released.assert_called_once_with(now=now, days=7, limit=12)
    fetch_upcoming.assert_called_once_with(now=now, days=21, limit=12)


@pytest.mark.parametrize("released_error", [None, httpx.ReadTimeout("calendar unavailable")])
def test_sparse_flow_evidence_is_explicit_and_does_not_hide_other_inputs(monkeypatch, released_error):
    now = datetime(2026, 9, 25, 14, tzinfo=UTC)
    monkeypatch.setattr(context, "fetch_sp500_session_move", Mock(side_effect=ValueError("no quotes")))
    monkeypatch.setattr(context, "_recent_news", Mock(return_value=[]))
    monkeypatch.setattr(context, "fetch_upcoming_us_events", Mock(return_value=[]))
    monkeypatch.setattr(context, "fetch_recent_us_events", Mock(return_value=[], side_effect=released_error))
    result = context.build_market_analysis_context(object(), "test", now.date(), now)
    assert result["sp500_session_move"] is None
    assert result["current_market_context"] == {"released_us_events": [], "warnings": ["released_us_events_unavailable"]}
    assert set(result["warnings"]) == {"sp500_session_move_unavailable", "recent_market_news_unavailable", "upcoming_us_events_unavailable"}


def test_historical_analysis_does_not_leak_todays_events_or_prices(monkeypatch):
    fetchers = ["fetch_sp500_session_move", "fetch_recent_us_events", "fetch_upcoming_us_events", "_recent_news"]
    mocks = [Mock(side_effect=AssertionError("must not request current evidence")) for _ in fetchers]
    for name, mock in zip(fetchers, mocks):
        monkeypatch.setattr(context, name, mock)
    result = context.build_market_analysis_context(object(), "test", date(2026, 9, 24), datetime(2026, 9, 25, 14, tzinfo=UTC))
    assert result["current_market_context"]["released_us_events"] == []
    assert result["warnings"] == ["horizontal_evidence_skipped_for_historical_as_of"]
    for mock in mocks:
        mock.assert_not_called()
