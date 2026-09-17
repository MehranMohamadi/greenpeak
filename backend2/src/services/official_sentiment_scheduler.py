"""Periodic refresh for public sentiment and volatility sources."""

from datetime import UTC, datetime, timedelta

from apscheduler.schedulers.background import BackgroundScheduler

from ..core.config import get_settings
from .official_sentiment import official_sentiment_service


def create_official_sentiment_scheduler() -> BackgroundScheduler | None:
    settings = get_settings()
    if not settings.greenpeak_official_sentiment_enabled:
        return None
    scheduler = BackgroundScheduler(timezone="UTC")
    scheduler.add_job(
        official_sentiment_service.refresh_all,
        "interval",
        hours=6,
        id="official-sentiment-refresh",
        replace_existing=True,
        coalesce=True,
        max_instances=1,
        next_run_time=datetime.now(UTC) + timedelta(hours=6),
    )
    return scheduler
