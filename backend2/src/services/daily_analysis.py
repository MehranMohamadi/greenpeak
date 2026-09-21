"""Once-daily persisted LLM analysis, coordinated across API workers."""

import logging
from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from pymongo import MongoClient, ReturnDocument
from pymongo.errors import DuplicateKeyError

from ..core.config import get_settings
from .llm_engine.provider import OpenAICompatibleProvider
from .persisted_analysis import run_persisted_analysis
from ..utils.telegram import build_telegram_market_report, send_telegram_market_report

logger = logging.getLogger(__name__)
RUN_COLLECTION = "gp_scheduled_analysis_runs"
NOTIFICATION_RETRY_MINUTES = 10


def should_schedule_catchup(now: datetime, hour: int, minute: int) -> bool:
    """Only catch up after today's configured Tehran-local run time has passed."""
    scheduled_at = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
    return now >= scheduled_at


def next_scheduled_analysis_at(now: datetime | None = None) -> datetime | None:
    """Return the next configured daily-analysis run in its local timezone."""
    settings = get_settings()
    if not settings.greenpeak_daily_analysis_enabled:
        return None
    if settings.greenpeak_llm_provider != "openai-compatible" or not settings.greenpeak_llm_api_key or not settings.greenpeak_llm_model:
        return None
    try:
        timezone = ZoneInfo(settings.greenpeak_daily_analysis_timezone)
    except ZoneInfoNotFoundError:
        return None

    current = now.astimezone(timezone) if now else datetime.now(timezone)
    trigger = CronTrigger(
        hour=settings.greenpeak_daily_analysis_hour,
        minute=settings.greenpeak_daily_analysis_minute,
        timezone=timezone,
    )
    return trigger.get_next_fire_time(None, current)


def market_analysis_completed(result: dict) -> bool:
    """Return whether this pipeline run produced a current market narrative."""
    return bool(result.get("llm", {}).get("market"))


def _market_report_date(report: dict) -> str | None:
    market = report.get("market", report)
    value = market.get("as_of_date") or market.get("data_as_of")
    if isinstance(value, (date, datetime)):
        return value.date().isoformat() if isinstance(value, datetime) else value.isoformat()
    return str(value)[:10] if value else None


def _deliver_daily_notification(client, runs, run_key: str, local_day: date) -> None:
    """Claim and deliver one notification attempt for a completed market run."""
    now = datetime.now(UTC)
    run = runs.find_one_and_update(
        {
            "run_key": run_key,
            "status": {"$in": ["success", "partial"]},
            "result.llm.market": {"$ne": None},
            "notification.status": {"$in": ["pending", "failed"]},
        },
        {
            "$set": {"notification.status": "sending", "notification.last_attempt_at": now},
            "$inc": {"notification.attempts": 1},
        },
        return_document=ReturnDocument.AFTER,
    )
    if not run:
        return

    settings = get_settings()
    outcome = {"notification.status": "failed", "notification.error_code": "telegram_send_failed"}
    try:
        market_data = build_telegram_market_report(client, settings.mongodb_database)
        if not market_data:
            outcome["notification.error_code"] = "market_report_missing"
        elif _market_report_date(market_data) != local_day.isoformat():
            outcome["notification.error_code"] = "market_report_date_mismatch"
        elif send_telegram_market_report(market_data):
            outcome = {
                "notification.status": "sent",
                "notification.sent_at": datetime.now(UTC),
                "notification.error_code": None,
            }
    except Exception:
        logger.exception("Daily Telegram notification failed")
    runs.update_one({"run_key": run_key}, {"$set": outcome})


def retry_daily_notification() -> None:
    """Retry today's failed Telegram delivery without regenerating analysis."""
    settings = get_settings()
    try:
        timezone = ZoneInfo(settings.greenpeak_daily_analysis_timezone)
    except ZoneInfoNotFoundError:
        logger.error("Daily analysis timezone is invalid; notification retry skipped")
        return

    local_day = datetime.now(timezone).date()
    run_key = f"daily:{local_day.isoformat()}"
    client = MongoClient(settings.mongodb_url, serverSelectionTimeoutMS=5000)
    try:
        runs = client[settings.mongodb_database][RUN_COLLECTION]
        _deliver_daily_notification(client, runs, run_key, local_day)
    except Exception:
        logger.exception("Daily Telegram notification retry failed")
    finally:
        client.close()


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
        status = "partial" if result["errors"] else "success"
        notification_status = "pending" if market_analysis_completed(result) else "unavailable"
        runs.update_one(
            {"run_key": run_key},
            {
                "$set": {
                    "status": status,
                    "finished_at": datetime.now(UTC),
                    "result": result,
                    "notification": {
                        "status": notification_status,
                        "attempts": 0,
                        "error_code": None if notification_status == "pending" else "market_not_generated",
                    },
                }
            },
        )
        if notification_status == "pending":
            _deliver_daily_notification(client, runs, run_key, local_day)
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
    scheduler.add_job(
        retry_daily_notification,
        CronTrigger(minute=f"*/{NOTIFICATION_RETRY_MINUTES}", timezone=timezone),
        id="greenpeak-daily-analysis-notification-retry",
        replace_existing=True,
        coalesce=True,
        max_instances=1,
    )
    # A restart before 16:00 must not generate an early analysis. If the server
    # comes back after the configured run time, catch up once; the shared Mongo
    # run key prevents a second generation for the same Tehran calendar day.
    if should_schedule_catchup(datetime.now(timezone), settings.greenpeak_daily_analysis_hour, settings.greenpeak_daily_analysis_minute):
        scheduler.add_job(
            run_daily_analysis,
            id="greenpeak-daily-analysis-catchup",
            replace_existing=True,
            max_instances=1,
        )
    return scheduler
