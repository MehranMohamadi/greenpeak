import logging
from datetime import UTC, datetime
from zoneinfo import ZoneInfo

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from pymongo import MongoClient

from ...core.config import get_settings
from ..llm_engine.provider import OpenAICompatibleProvider
from .job import ALPHA_TOPIC_ROTATION, run_qualified_refresh
from .processing import stable_item_id
from .repository import MongoNewsRepository
from .sources import fetch_alpha, fetch_rss

logger = logging.getLogger(__name__)


def ingest_news() -> None:
    settings = get_settings(); now = datetime.now(UTC); hour_key = now.strftime("%Y-%m-%dT%H")
    client = MongoClient(settings.mongodb_url, serverSelectionTimeoutMS=5000); repository = MongoNewsRepository(client, settings.mongodb_database)
    metrics = {"sources": {}, "errors": {}}
    try:
        repository.ensure_indexes()
        if not repository.claim_run(f"ingest:{hour_key}", "ingest"): return
        topic = ALPHA_TOPIC_ROTATION[(now.timetuple().tm_yday * 24 + now.hour) % len(ALPHA_TOPIC_ROTATION)]
        fetches = {
            "alpha_vantage": lambda: fetch_alpha(settings.alpha_vantage_key, topic) if settings.alpha_vantage_key else [],
            "cnbc_rss": lambda: fetch_rss(settings.greenpeak_cnbc_rss_url, "cnbc_rss"),
            "investing_rss": lambda: fetch_rss(settings.greenpeak_investing_rss_url, "investing_rss"),
        }
        for source, fetch in fetches.items():
            try:
                items = fetch(); documents = [{"item_id": stable_item_id(x), **x.model_dump(mode="python")} for x in items]
                metrics["sources"][source] = {"received": len(items), "inserted": repository.save_raw(documents)}
            except Exception as exc:
                metrics["errors"][source] = type(exc).__name__; logger.warning("News source %s failed: %s", source, type(exc).__name__)
        status = "partial" if metrics["errors"] else "success"
        repository.finish_run(f"ingest:{hour_key}", status, metrics)
    except Exception as exc:
        logger.exception("News ingestion failed")
        repository.finish_run(f"ingest:{hour_key}", "failed", metrics, type(exc).__name__)
    finally: client.close()


def qualify_news() -> None:
    settings = get_settings(); client = MongoClient(settings.mongodb_url, serverSelectionTimeoutMS=5000)
    try:
        provider = OpenAICompatibleProvider(settings.greenpeak_llm_api_key, settings.greenpeak_llm_model, settings.greenpeak_llm_base_url, timeout=180)
        repository = MongoNewsRepository(client, settings.mongodb_database); repository.ensure_indexes()
        run_qualified_refresh(repository, provider)
    except Exception: logger.exception("Qualified news refresh failed")
    finally: client.close()


def create_news_scheduler() -> BackgroundScheduler | None:
    settings = get_settings()
    if not settings.greenpeak_news_enabled: return None
    timezone = ZoneInfo("Asia/Tehran"); scheduler = BackgroundScheduler(timezone=timezone, daemon=True)
    scheduler.add_job(ingest_news, CronTrigger(minute=5, timezone=timezone), id="greenpeak-news-ingest", replace_existing=True, coalesce=True, max_instances=1)
    if settings.greenpeak_llm_provider == "openai-compatible" and settings.greenpeak_llm_api_key and settings.greenpeak_llm_model:
        scheduler.add_job(qualify_news, CronTrigger(hour=16, minute=0, timezone=timezone), id="greenpeak-news-qualified", replace_existing=True, coalesce=True, max_instances=1)
    return scheduler
