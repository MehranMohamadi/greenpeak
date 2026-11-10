"""Describe narrative freshness without generating or relabelling analysis."""

from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from ..core.config import get_settings
from .analysis_schedule import market_schedule_window


def _datetime(value):
    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    if not isinstance(value, datetime):
        return None
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value


def market_analysis_freshness(snapshot: dict, *, now: datetime | None = None) -> dict:
    settings = get_settings()
    try:
        timezone = ZoneInfo(settings.greenpeak_daily_analysis_timezone)
    except ZoneInfoNotFoundError:
        timezone = ZoneInfo("Asia/Tehran")
    current = (now or datetime.now(UTC)).astimezone(timezone)
    due = None
    scheduled = None
    expected = current.date()
    if settings.greenpeak_daily_analysis_enabled:
        try:
            due, upcoming = market_schedule_window(settings, current)
            expected = due.date()
            scheduled = due if due.astimezone(timezone).date() == current.date() else upcoming
        except ZoneInfoNotFoundError:
            pass
    generated = _datetime(snapshot.get("analysis_generated_at"))
    try:
        as_of = date.fromisoformat(str(snapshot.get("as_of_date"))[:10])
    except (TypeError, ValueError):
        as_of = None
    generated_day = generated.astimezone(timezone).date() if generated else None
    if not generated_day or not as_of or generated > current + timedelta(minutes=5) or as_of > current.date():
        status = "unknown"
    elif not settings.greenpeak_daily_analysis_enabled:
        status = "current" if min(generated_day, as_of) >= current.date() else "outdated"
    elif due is None:
        status = "unknown"
    elif generated >= due and as_of >= expected:
        status = "current" if min(generated_day, as_of) >= current.date() else "scheduled"
    else:
        status = "overdue"
    return {
        "status": status,
        "is_stale": status in {"overdue", "outdated", "unknown"},
        "expected_as_of_date": expected.isoformat(),
        "scheduled_for": scheduled.astimezone(timezone).isoformat() if scheduled else None,
        "checked_at": current.isoformat(),
        "timezone": str(timezone),
    }
