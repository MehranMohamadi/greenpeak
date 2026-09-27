import os
from datetime import UTC, datetime

os.environ["DEBUG"] = "false"

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


def test_early_session_uses_previous_completed_sp500_session():
    result = parse_sp500_session_move(
        _payload(),
        datetime(2026, 9, 25, 14, 0, tzinfo=UTC),
    )

    assert result["session_scope"] == "previous_completed_session"
    assert result["session_date"] == "2026-09-24"
    assert result["previous_session_date"] == "2026-09-23"
