from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, HTTPException, Query
from pymongo import MongoClient
from pymongo.errors import PyMongoError

from ....core.config import get_settings
from ....services.llm_engine.provider import OpenAICompatibleProvider
from ....services.news.job import explain_cluster
from ....services.news.repository import MongoNewsRepository

router = APIRouter(prefix="/news", tags=["S&P 500 News"])


def _repository():
    settings = get_settings(); client = MongoClient(settings.mongodb_url, serverSelectionTimeoutMS=3000)
    return client, MongoNewsRepository(client, settings.mongodb_database)


@router.get("/daily/latest")
def latest_daily_news():
    client, repository = _repository()
    try:
        value = repository.latest_daily()
        if not value: raise HTTPException(404, detail={"code": "NEWS_NOT_GENERATED", "message": "Today's qualified news is not available yet."})
        return {"ok": True, "data": value}
    except HTTPException: raise
    except PyMongoError: raise HTTPException(503, detail={"code": "NEWS_STORE_UNAVAILABLE", "message": "News storage is temporarily unavailable."})
    finally: client.close()


@router.get("/coverage")
def news_coverage(days: int = Query(default=14, ge=1, le=90)):
    """Return sanitized source-value metrics; no raw article payload is exposed."""
    client, repository = _repository()
    try:
        runs = repository.coverage_runs(datetime.now(UTC) - timedelta(days=days))
        totals = {key: 0 for key in ("raw_alpha_vantage", "raw_cnbc_rss", "raw_investing_rss", "duplicates", "supplement_cnbc", "supplement_investing", "final_clusters", "selected_alpha_vantage", "selected_cnbc_rss", "selected_investing_rss")}
        for run in runs:
            metrics = run.get("metrics", {}); raw = metrics.get("raw_by_source", {}); selected = metrics.get("selected_by_source", {})
            totals["raw_alpha_vantage"] += raw.get("alpha_vantage", 0); totals["raw_cnbc_rss"] += raw.get("cnbc_rss", 0); totals["raw_investing_rss"] += raw.get("investing_rss", 0)
            totals["duplicates"] += metrics.get("deterministic_duplicates", 0); totals["supplement_cnbc"] += metrics.get("supplement_cnbc", 0); totals["supplement_investing"] += metrics.get("supplement_investing", 0); totals["final_clusters"] += metrics.get("final_clusters", 0)
            totals["selected_alpha_vantage"] += selected.get("alpha_vantage", 0); totals["selected_cnbc_rss"] += selected.get("cnbc_rss", 0); totals["selected_investing_rss"] += selected.get("investing_rss", 0)
        return {"ok": True, "data": {"window_days": days, "run_count": len(runs), "totals": totals, "runs": runs}}
    except PyMongoError: raise HTTPException(503, detail={"code": "NEWS_STORE_UNAVAILABLE", "message": "News storage is temporarily unavailable."})
    finally: client.close()


@router.post("/clusters/{cluster_id}/why-important")
def why_important(cluster_id: str):
    settings = get_settings()
    if settings.greenpeak_llm_provider != "openai-compatible" or not settings.greenpeak_llm_api_key or not settings.greenpeak_llm_model:
        raise HTTPException(503, detail={"code": "LLM_NOT_CONFIGURED", "message": "Explanation generation is unavailable."})
    client, repository = _repository()
    try:
        provider = OpenAICompatibleProvider(settings.greenpeak_llm_api_key, settings.greenpeak_llm_model, settings.greenpeak_llm_base_url)
        return {"ok": True, "data": explain_cluster(repository, provider, cluster_id)}
    except KeyError: raise HTTPException(404, detail={"code": "NEWS_CLUSTER_NOT_FOUND", "message": "News cluster was not found."})
    except PyMongoError: raise HTTPException(503, detail={"code": "NEWS_STORE_UNAVAILABLE", "message": "News storage is temporarily unavailable."})
    finally: client.close()
