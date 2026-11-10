"""Shared schedule definitions for execution, freshness and admin descriptions."""

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo


@dataclass(frozen=True)
class AnalysisSlot:
    slot_id: str
    hour: int
    minute: int
    timezone: str
    market_only: bool = False

    def scheduled_at(self, now: datetime, day_offset: int = 0) -> datetime:
        local = now.astimezone(ZoneInfo(self.timezone))
        return (local + timedelta(days=day_offset)).replace(
            hour=self.hour, minute=self.minute, second=0, microsecond=0,
        )

    def run_key(self, local_day: date) -> str:
        return f"{self.slot_id}:{local_day.isoformat()}"


def analysis_slots(settings, *, defaults: bool = False) -> list[AnalysisSlot]:
    from ..core.config import Settings

    def value(name):
        return Settings.model_fields[name].default if defaults else getattr(settings, name)

    if not value("greenpeak_daily_analysis_enabled"):
        return []
    slots = [AnalysisSlot(
        "daily", value("greenpeak_daily_analysis_hour"), value("greenpeak_daily_analysis_minute"),
        value("greenpeak_daily_analysis_timezone"),
    )]
    if value("greenpeak_market_evening_analysis_enabled"):
        evening = AnalysisSlot(
            "market-evening", value("greenpeak_market_evening_analysis_hour"),
            value("greenpeak_market_evening_analysis_minute"),
            value("greenpeak_market_evening_analysis_timezone"), market_only=True,
        )
        if (evening.hour, evening.minute, evening.timezone) != (slots[0].hour, slots[0].minute, slots[0].timezone):
            slots.append(evening)
    return slots


def market_schedule_window(settings, now: datetime) -> tuple[datetime, datetime]:
    """Return the most recent due run and the next run across local day boundaries."""
    times = [slot.scheduled_at(now, offset) for slot in analysis_slots(settings) for offset in (-1, 0, 1)]
    return max(value for value in times if value <= now), min(value for value in times if value > now)
