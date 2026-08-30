from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query
from pymongo import MongoClient
from pymongo.errors import PyMongoError

from ....core.config import get_settings
from ....services.news.feed import SEARCH_TOPICS, SOURCE_IDS, build_source_feed
from ....services.news.repository import MongoNewsRepository
from ....services.news.scheduler import ingest_news

router = APIRouter(prefix="/news", tags=["S&P 500 News"])


def _repository():
    settings = get_settings(); client = MongoClient(settings.mongodb_url, serverSelectionTimeoutMS=3000)
    return client, MongoNewsRepository(client, settings.mongodb_database)


def _run_bootstrap(run_key: str) -> None:
    client, repository = _repository()
    try:
        ingest_news(SEARCH_TOPICS, "bootstrap-ingest")
        counts = {source: len(repository.source_raw(source, datetime.now(UTC) - timedelta(days=7))) for source in SOURCE_IDS}
        repository.finish_run(run_key, "success" if any(counts.values()) else "failed", {"source_counts": counts}, None if any(counts.values()) else "NEWS_NOT_FETCHED")
    except Exception as exc:
        repository.finish_run(run_key, "failed", {}, type(exc).__name__)
    finally: client.close()


@router.get("/sources/{source}")
def source_news(source: str, limit: int = Query(default=50, ge=20, le=100)):
    if source not in SOURCE_IDS:
        raise HTTPException(404, detail={"code": "NEWS_SOURCE_NOT_FOUND", "message": "Unknown news source."})
    client, repository = _repository()
    try:
        documents = repository.source_raw(source, datetime.now(UTC) - timedelta(days=7))
        if not documents: raise HTTPException(404, detail={"code": "NEWS_SOURCE_EMPTY", "message": "This source has not been fetched yet."})
        return {"ok": True, "data": build_source_feed(source, documents, limit)}
    except HTTPException: raise
    except PyMongoError: raise HTTPException(503, detail={"code": "NEWS_STORE_UNAVAILABLE", "message": "News storage is temporarily unavailable."})
    finally: client.close()


@router.post("/bootstrap", status_code=202)
def bootstrap_news(background_tasks: BackgroundTasks):
    """Fetch all independent source tabs once when production storage is empty."""
    settings = get_settings()
    if not settings.alpha_vantage_key:
        raise HTTPException(503, detail={"code": "ALPHA_VANTAGE_NOT_CONFIGURED", "message": "Alpha Vantage is not configured."})
    client, repository = _repository()
    try:
        repository.ensure_indexes()
        counts = {source: len(repository.source_raw(source, datetime.now(UTC) - timedelta(days=7), 1)) for source in SOURCE_IDS}
        if all(counts.values()): return {"ok": True, "data": {"status": "ready", "source_counts": counts}}
        local_day = datetime.now(ZoneInfo("Asia/Tehran")).date().isoformat(); run_key = f"source-bootstrap-v2:{local_day}"
        if repository.claim_run(run_key, "bootstrap"):
            background_tasks.add_task(_run_bootstrap, run_key); status = "queued"
        else: status = "running"
        return {"ok": True, "data": {"status": status, "run_key": run_key}}
    except PyMongoError: raise HTTPException(503, detail={"code": "NEWS_STORE_UNAVAILABLE", "message": "News storage is temporarily unavailable."})
    finally: client.close()
