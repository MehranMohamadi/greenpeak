"""Once-daily persisted LLM analysis, coordinated across API workers."""

import logging
from datetime import UTC, datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError

from ..core.config import get_settings
from .llm_engine.provider import OpenAICompatibleProvider
from .persisted_analysis import run_persisted_analysis

logger = logging.getLogger(__name__)
RUN_COLLECTION = "gp_scheduled_analysis_runs"


def run_daily_analysis() -> None:
    """Generate one shared analysis per configured local calendar day."""
    settings = get_settings()
    try:
        timezone = ZoneInfo(settings.greenpeak_daily_analysis_timezone)
    except ZoneInfoNotFoundError:
        logger.error("Daily analysis timezone is invalid; scheduled run skipped")
        return

    local_day = datetime.now(timezone).date()
    run_key = f"daily:{local_day.isoformat()}"
    client = MongoClient(settings.mongodb_url, serverSelectionTimeoutMS=5000)
    runs = client[settings.mongodb_database][RUN_COLLECTION]
    try:
        runs.create_index("run_key", unique=True)
        try:
            runs.insert_one(
                {
                    "run_key": run_key,
                    "as_of_date": local_day.isoformat(),
                    "status": "running",
                    "started_at": datetime.now(UTC),
                }
            )
        except DuplicateKeyError:
            return

        provider = OpenAICompatibleProvider(
            settings.greenpeak_llm_api_key,
            settings.greenpeak_llm_model,
            settings.greenpeak_llm_base_url,
            timeout=180,
        )
        result = run_persisted_analysis(
            client,
            settings.mongodb_database,
            provider,
            local_day,
            force_llm=True,
        )
        runs.update_one(
            {"run_key": run_key},
            {"$set": {"status": "partial" if result["errors"] else "success", "finished_at": datetime.now(UTC), "result": result}},
        )
    except Exception as exc:
        logger.exception("Daily analysis failed")
        runs.update_one(
            {"run_key": run_key},
            {"$set": {"status": "failed", "finished_at": datetime.now(UTC), "error_code": type(exc).__name__}},
        )
    finally:
        client.close()


def create_daily_analysis_scheduler() -> BackgroundScheduler | None:
    """Create the server scheduler when daily LLM generation is configured."""
    settings = get_settings()
    if not settings.greenpeak_daily_analysis_enabled:
        return None
    if settings.greenpeak_llm_provider != "openai-compatible" or not settings.greenpeak_llm_api_key or not settings.greenpeak_llm_model:
        logger.warning("Daily analysis scheduler is disabled because the LLM provider is not configured")
        return None

    timezone = ZoneInfo(settings.greenpeak_daily_analysis_timezone)
    scheduler = BackgroundScheduler(timezone=timezone, daemon=True)
    scheduler.add_job(
        run_daily_analysis,
        CronTrigger(
            hour=settings.greenpeak_daily_analysis_hour,
            minute=settings.greenpeak_daily_analysis_minute,
            timezone=timezone,
        ),
        id="greenpeak-daily-analysis",
        replace_existing=True,
        coalesce=True,
        max_instances=1,
    )
    # Catch up after a server restart if today's cron time was missed. The
    # database run key makes this a no-op when another worker already ran it.
    scheduler.add_job(
        run_daily_analysis,
        id="greenpeak-daily-analysis-catchup",
        replace_existing=True,
        max_instances=1,
    )
    return scheduler
