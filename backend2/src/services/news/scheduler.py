import logging
from datetime import UTC, datetime
from zoneinfo import ZoneInfo

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from pymongo import MongoClient

from ...core.config import get_settings
from .feed import stable_item_id
from .repository import MongoNewsRepository
from .sources import fetch_rss
from .source_config import rss_sources
from .access_review import review_source_access
from .cnbc import fetch_cnbc_sections

logger = logging.getLogger(__name__)


def _ten_minute_bucket(value: datetime) -> str:
    bucket_minute = (value.minute // 10) * 10
    return value.replace(minute=bucket_minute, second=0, microsecond=0).strftime("%Y-%m-%dT%H:%M")


def ingest_news(alpha_topics: tuple[str, ...] | None = None, run_prefix: str = "ingest") -> None:
    # Keep the old call signature for bootstrap callers; only the five RSS feeds run.
    settings = get_settings(); now = datetime.now(UTC); interval_key = _ten_minute_bucket(now)
    client = MongoClient(settings.mongodb_url, serverSelectionTimeoutMS=5000); repository = MongoNewsRepository(client, settings.mongodb_database)
    metrics = {"sources": {}, "errors": {}}
    try:
        repository.ensure_indexes()
        run_key = f"{run_prefix}:{interval_key}"
        if not repository.claim_run(run_key, "ingest"): return
        for source, url in rss_sources(settings).items():
            documents, feed_error = [], None
            try:
                section_results = None
                if source == "cnbc_rss":
                    items, section_results = fetch_cnbc_sections(settings, fetcher=fetch_rss)
                    if any(result["status"] == "error" for result in section_results.values()):
                        metrics["errors"][source] = "CNBC_SECTION_UNAVAILABLE"
                        if not items:
                            feed_error = "CNBC_SECTION_UNAVAILABLE"
                else:
                    items = fetch_rss(url, source)
                documents = []
                for item in items:
                    document = item.model_dump(mode="python")
                    document["url"] = str(item.url)
                    document["canonical_url"] = str(item.canonical_url) if item.canonical_url else None
                    documents.append({"item_id": stable_item_id(item), **document})
                metrics["sources"][source] = {"received": len(items), "inserted": repository.save_raw(documents)}
                if section_results is not None:
                    metrics["sources"][source]["sections"] = section_results
            except Exception as exc:
                feed_error = type(exc).__name__
                metrics["errors"][source] = feed_error; logger.warning("News source %s failed: %s", source, feed_error)
            try:
                review_source_access(repository, source, documents, now=now, feed_error=feed_error)
            except Exception as exc:
                # A monitoring failure must not prevent the other feeds being saved.
                logger.warning("News access review %s failed: %s", source, type(exc).__name__)
        status = "partial" if metrics["errors"] else "success"
        repository.finish_run(run_key, status, metrics)
    except Exception as exc:
        logger.exception("News ingestion failed")
        repository.finish_run(f"{run_prefix}:{interval_key}", "failed", metrics, type(exc).__name__)
    finally: client.close()


def create_news_scheduler() -> BackgroundScheduler | None:
    settings = get_settings()
    if not settings.greenpeak_news_enabled: return None
    timezone = ZoneInfo("Asia/Tehran"); scheduler = BackgroundScheduler(timezone=timezone, daemon=True)
    scheduler.add_job(ingest_news, CronTrigger(minute="*/10", timezone=timezone), id="greenpeak-news-ingest", replace_existing=True, coalesce=True, max_instances=1)
    return scheduler
