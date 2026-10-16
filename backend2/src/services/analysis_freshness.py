"""Describe narrative freshness without generating or relabelling analysis."""

from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from ..core.config import get_settings


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
    scheduled = current.replace(hour=settings.greenpeak_daily_analysis_hour,
                                minute=settings.greenpeak_daily_analysis_minute,
                                second=0, microsecond=0)
    expected = current.date() if current >= scheduled else current.date() - timedelta(days=1)
    generated = _datetime(snapshot.get("analysis_generated_at"))
    try:
        as_of = date.fromisoformat(str(snapshot.get("as_of_date"))[:10])
    except (TypeError, ValueError):
        as_of = None
    generated_day = generated.astimezone(timezone).date() if generated else None
    if not generated_day or not as_of or generated > current + timedelta(minutes=5) or as_of > current.date():
        status = "unknown"
    elif min(generated_day, as_of) >= current.date():
        status = "current"
    elif not settings.greenpeak_daily_analysis_enabled:
        status = "outdated"
    elif min(generated_day, as_of) >= expected and current < scheduled:
        status = "scheduled"
    else:
        status = "overdue"
    return {
        "status": status,
        "is_stale": status in {"overdue", "outdated", "unknown"},
        "expected_as_of_date": expected.isoformat(),
        "scheduled_for": scheduled.isoformat() if settings.greenpeak_daily_analysis_enabled else None,
        "checked_at": current.isoformat(),
        "timezone": str(timezone),
    }
