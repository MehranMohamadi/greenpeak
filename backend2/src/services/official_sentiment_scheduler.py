"""Periodic refresh for public sentiment and volatility sources."""

from datetime import UTC, datetime

from apscheduler.schedulers.background import BackgroundScheduler

from ..core.config import get_settings
from .official_sentiment import official_sentiment_service


def refresh_vix_term_structure() -> None:
    """Refresh the daily Cboe volatility files around the U.S. market close."""
    official_sentiment_service.get("vix_term_structure", force=True)


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
        next_run_time=datetime.now(UTC),
    )
    scheduler.add_job(
        refresh_vix_term_structure,
        "cron",
        day_of_week="mon-fri",
        hour="20-23",
        minute=30,
        id="cboe-vix-daily-close-refresh",
        replace_existing=True,
        coalesce=True,
        max_instances=1,
    )
    return scheduler
