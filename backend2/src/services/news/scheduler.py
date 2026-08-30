import logging
from datetime import UTC, datetime
from zoneinfo import ZoneInfo

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from pymongo import MongoClient

from ...core.config import get_settings
from .feed import stable_item_id
from .repository import MongoNewsRepository
from .sources import fetch_alpha, fetch_rss

logger = logging.getLogger(__name__)
ALPHA_TOPIC_ROTATION = (
    "financial_markets", "economy_monetary", "economy_macro", "financial_markets",
    "economy_monetary", "economy_macro", "financial_markets", "earnings",
)


def ingest_news(alpha_topics: tuple[str, ...] | None = None, run_prefix: str = "ingest") -> None:
    settings = get_settings(); now = datetime.now(UTC); hour_key = now.strftime("%Y-%m-%dT%H")
    client = MongoClient(settings.mongodb_url, serverSelectionTimeoutMS=5000); repository = MongoNewsRepository(client, settings.mongodb_database)
    metrics = {"sources": {}, "errors": {}}
    try:
        repository.ensure_indexes()
        run_key = f"{run_prefix}:{hour_key}"
        if not repository.claim_run(run_key, "ingest"): return
        topics = alpha_topics or (ALPHA_TOPIC_ROTATION[(now.timetuple().tm_yday * 24 + now.hour) % len(ALPHA_TOPIC_ROTATION)],)
        def fetch_alpha_topics():
            values = []
            if settings.alpha_vantage_key:
                for topic in topics: values.extend(fetch_alpha(settings.alpha_vantage_key, topic))
            return values
        fetches = {
            "alpha_vantage": fetch_alpha_topics,
            "cnbc_rss": lambda: fetch_rss(settings.greenpeak_cnbc_rss_url, "cnbc_rss"),
            "investing_rss": lambda: fetch_rss(settings.greenpeak_investing_rss_url, "investing_rss"),
        }
        for source, fetch in fetches.items():
            try:
                items = fetch(); documents = []
                for item in items:
                    document = item.model_dump(mode="python")
                    document["url"] = str(item.url)
                    document["canonical_url"] = str(item.canonical_url) if item.canonical_url else None
                    documents.append({"item_id": stable_item_id(item), **document})
                metrics["sources"][source] = {"received": len(items), "inserted": repository.save_raw(documents)}
            except Exception as exc:
                metrics["errors"][source] = type(exc).__name__; logger.warning("News source %s failed: %s", source, type(exc).__name__)
        status = "partial" if metrics["errors"] else "success"
        repository.finish_run(run_key, status, metrics)
    except Exception as exc:
        logger.exception("News ingestion failed")
        repository.finish_run(f"{run_prefix}:{hour_key}", "failed", metrics, type(exc).__name__)
    finally: client.close()


def create_news_scheduler() -> BackgroundScheduler | None:
    settings = get_settings()
    if not settings.greenpeak_news_enabled: return None
    timezone = ZoneInfo("Asia/Tehran"); scheduler = BackgroundScheduler(timezone=timezone, daemon=True)
    scheduler.add_job(ingest_news, CronTrigger(minute=5, timezone=timezone), id="greenpeak-news-ingest", replace_existing=True, coalesce=True, max_instances=1)
    return scheduler
