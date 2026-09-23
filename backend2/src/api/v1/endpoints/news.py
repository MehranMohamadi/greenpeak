from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

import httpx
from fastapi import APIRouter, BackgroundTasks, HTTPException, Path, Query
from pymongo import MongoClient
from pymongo.errors import PyMongoError

from ....core.config import get_settings
from ....services.economic_calendar import TRADAYS_BASE_URL, fetch_recent_us_events, fetch_upcoming_us_events
from ....services.llm_engine.provider import OpenAICompatibleProvider
from ....services.news.article_analysis import NEWS_ANALYSIS_VERSION, analyze_news_document
from ....services.news.feed import SEARCH_TOPICS, SOURCE_IDS, build_source_feed
from ....services.news.repository import MongoNewsRepository
from ....services.news.scheduler import ingest_news

router = APIRouter(prefix="/news", tags=["S&P 500 News"])
BOOTSTRAP_VERSION = "v4"


def _repository():
    settings = get_settings(); client = MongoClient(settings.mongodb_url, serverSelectionTimeoutMS=3000)
    return client, MongoNewsRepository(client, settings.mongodb_database)


def _run_bootstrap(run_key: str) -> None:
    client, repository = _repository()
    try:
        ingest_news(SEARCH_TOPICS, f"bootstrap-ingest-{BOOTSTRAP_VERSION}")
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
        feed = build_source_feed(source, documents, limit)
        if source == "alpha_vantage":
            item_ids = [item["item_id"] for item in feed["items"] if item.get("item_id")]
            analyses = repository.article_analyses(item_ids, NEWS_ANALYSIS_VERSION)
            titles_fa = {
                item["item_id"]: item["title_fa"]
                for item in analyses
                if item.get("item_id") and item.get("title_fa")
            }
            for item in feed["items"]:
                item["title_fa"] = titles_fa.get(item.get("item_id"))
        return {"ok": True, "data": feed}
    except HTTPException: raise
    except PyMongoError: raise HTTPException(503, detail={"code": "NEWS_STORE_UNAVAILABLE", "message": "News storage is temporarily unavailable."})
    finally: client.close()


@router.get("/items/{item_id}/analysis")
def news_item_analysis(item_id: str = Path(pattern=r"^[a-zA-Z0-9_-]{1,80}$")):
    """Translate and interpret one stored article after reading its source page."""
    settings = get_settings()
    client, repository = _repository()
    try:
        cached = repository.article_analysis(item_id, NEWS_ANALYSIS_VERSION)
        if cached:
            return {"ok": True, "data": cached}
        document = repository.item_by_id(item_id)
        if not document:
            raise HTTPException(404, detail={"code": "NEWS_ITEM_NOT_FOUND", "message": "News item was not found."})
        if (
            settings.greenpeak_llm_provider != "openai-compatible"
            or not settings.greenpeak_llm_api_key
            or not settings.greenpeak_llm_model
        ):
            raise HTTPException(503, detail={"code": "LLM_NOT_CONFIGURED", "message": "News analysis is not configured."})
        provider = OpenAICompatibleProvider(
            settings.greenpeak_llm_api_key,
            settings.greenpeak_llm_model,
            settings.greenpeak_llm_base_url,
            timeout=120,
        )
        analysis = analyze_news_document(document, provider)
        repository.save_article_analysis(analysis)
        return {"ok": True, "data": analysis}
    except HTTPException:
        raise
    except PyMongoError:
        raise HTTPException(503, detail={"code": "NEWS_STORE_UNAVAILABLE", "message": "News storage is temporarily unavailable."})
    except (httpx.HTTPError, ValueError):
        raise HTTPException(502, detail={"code": "NEWS_ANALYSIS_UNAVAILABLE", "message": "The source article could not be analyzed."})
    finally:
        client.close()


@router.get("/calendar/upcoming")
def upcoming_calendar_events(limit: int = Query(default=6, ge=1, le=10)):
    try:
        items = fetch_upcoming_us_events(limit=limit)
        return {
            "ok": True,
            "data": {
                "items": items,
                "count": len(items),
                "source": "Tradays / MQL5",
                "source_url": TRADAYS_BASE_URL,
            },
        }
    except (httpx.HTTPError, ValueError):
        raise HTTPException(
            503,
            detail={
                "code": "CALENDAR_SOURCE_UNAVAILABLE",
                "message": "Economic calendar is temporarily unavailable.",
            },
        )


@router.get("/calendar/released")
def released_calendar_events(limit: int = Query(default=6, ge=1, le=10)):
    try:
        items = fetch_recent_us_events(limit=limit)
        return {
            "ok": True,
            "data": {
                "items": items,
                "count": len(items),
                "source": "Tradays / MQL5",
                "source_url": TRADAYS_BASE_URL,
            },
        }
    except (httpx.HTTPError, ValueError):
        raise HTTPException(
            503,
            detail={
                "code": "CALENDAR_SOURCE_UNAVAILABLE",
                "message": "Economic calendar is temporarily unavailable.",
            },
        )


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
        local_day = datetime.now(ZoneInfo("Asia/Tehran")).date().isoformat(); run_key = f"source-bootstrap-{BOOTSTRAP_VERSION}:{local_day}"
        if repository.claim_run(run_key, "bootstrap"):
            background_tasks.add_task(_run_bootstrap, run_key); status = "queued"
        else: status = "running"
        return {"ok": True, "data": {"status": status, "run_key": run_key}}
    except PyMongoError: raise HTTPException(503, detail={"code": "NEWS_STORE_UNAVAILABLE", "message": "News storage is temporarily unavailable."})
    finally: client.close()
