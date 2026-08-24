from datetime import UTC, date, datetime
from hmac import compare_digest
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Header, HTTPException
from pymongo import MongoClient
from pymongo.errors import PyMongoError

from ....core.config import get_settings
from ....services.greenpeak_config import load_registry
from ....services.llm_engine.repository import MongoNarrativeRepository
from ....services.llm_engine.schemas import DomainNarrative, IndicatorNarrative, MarketNarrative
from ....services.llm_engine.job import run_llm_pipeline
from ....services.llm_engine.provider import OpenAICompatibleProvider
from ....services.rate_features.repository import MongoFeatureRepository

router = APIRouter(tags=["Persisted GreenPeak Analysis"])


def _latest(level: str, subject_id: str, model):
    settings = get_settings()
    client = MongoClient(settings.mongodb_url, serverSelectionTimeoutMS=3000)
    try:
        document = MongoNarrativeRepository(client, settings.mongodb_database).latest(level, subject_id)
        if not document:
            raise HTTPException(status_code=404, detail={"code": "ANALYSIS_NOT_GENERATED", "message": "Analysis has not been generated yet."})
        return {"ok": True, "data": model.model_validate(document).model_dump(mode="json")}
    except HTTPException:
        raise
    except PyMongoError:
        raise HTTPException(status_code=503, detail={"code": "ANALYSIS_STORE_UNAVAILABLE", "message": "Analysis storage is temporarily unavailable."})
    finally:
        client.close()


@router.get("/indicators/{indicator_id}/analysis/latest")
def latest_indicator_analysis(indicator_id: str):
    if indicator_id not in load_registry()[2]:
        raise HTTPException(status_code=404, detail={"code": "INDICATOR_NOT_FOUND", "message": "Unknown indicator."})
    return _latest("indicator", indicator_id, IndicatorNarrative)


@router.get("/domains/{domain_id}/analysis/latest")
def latest_domain_analysis(domain_id: str):
    if domain_id not in {item.id for item in load_registry()[0].domains}:
        raise HTTPException(status_code=404, detail={"code": "DOMAIN_NOT_FOUND", "message": "Unknown domain."})
    return _latest("domain", domain_id, DomainNarrative)


@router.get("/market/analysis/latest")
def latest_market_analysis():
    return _latest("market", "sp500", MarketNarrative)


def _authorize_manual_run(authorization: str | None) -> None:
    settings = get_settings()
    if settings.environment != "production":
        return
    expected = settings.greenpeak_analysis_admin_token
    supplied = authorization.removeprefix("Bearer ").strip() if authorization else ""
    if not expected or not supplied or not compare_digest(supplied, expected):
        raise HTTPException(status_code=403, detail={"code": "MANUAL_ANALYSIS_FORBIDDEN", "message": "A valid analysis admin token is required."})


def _execute_manual_analysis(run_id: str, force_llm: bool) -> None:
    settings = get_settings()
    client = MongoClient(settings.mongodb_url, serverSelectionTimeoutMS=5000)
    try:
        client[settings.mongodb_database].gp_manual_analysis_runs.update_one(
            {"run_id": run_id}, {"$set": {"status": "running", "started_at": datetime.now(UTC)}}
        )
        provider = OpenAICompatibleProvider(settings.greenpeak_llm_api_key, settings.greenpeak_llm_model, settings.greenpeak_llm_base_url, timeout=180)
        result = run_llm_pipeline(
            MongoFeatureRepository(client, settings.mongodb_database),
            MongoNarrativeRepository(client, settings.mongodb_database),
            provider,
            date.today(),
            force=force_llm,
        )
        status = "partial" if result["errors"] else "success"
        client[settings.mongodb_database].gp_manual_analysis_runs.update_one(
            {"run_id": run_id},
            {"$set": {"status": status, "finished_at": datetime.now(UTC), "result": result}},
        )
    except Exception as exc:
        client[settings.mongodb_database].gp_manual_analysis_runs.update_one(
            {"run_id": run_id},
            {"$set": {"status": "failed", "finished_at": datetime.now(UTC), "error_code": type(exc).__name__}},
        )
    finally:
        client.close()


@router.post("/admin/analysis/run", status_code=202)
def run_manual_analysis(background_tasks: BackgroundTasks, force_llm: bool = True, authorization: str | None = Header(default=None)):
    """Queue an explicit operator action; normal page reads never execute analysis."""
    _authorize_manual_run(authorization)
    settings = get_settings()
    if settings.greenpeak_llm_provider != "openai-compatible" or not settings.greenpeak_llm_api_key or not settings.greenpeak_llm_model:
        raise HTTPException(status_code=503, detail={"code": "LLM_NOT_CONFIGURED", "message": "The LLM provider credentials are incomplete."})
    client = MongoClient(settings.mongodb_url, serverSelectionTimeoutMS=5000)
    run_id = str(uuid4())
    try:
        client[settings.mongodb_database].gp_manual_analysis_runs.insert_one({"run_id": run_id, "status": "queued", "created_at": datetime.now(UTC), "force_llm": force_llm})
    except PyMongoError:
        raise HTTPException(status_code=503, detail={"code": "ANALYSIS_STORE_UNAVAILABLE", "message": "Analysis storage is temporarily unavailable."})
    finally:
        client.close()
    background_tasks.add_task(_execute_manual_analysis, run_id, force_llm)
    return {"ok": True, "data": {"run_id": run_id, "status": "queued"}}


@router.get("/admin/analysis/runs/{run_id}")
def manual_analysis_status(run_id: str, authorization: str | None = Header(default=None)):
    _authorize_manual_run(authorization)
    settings = get_settings(); client = MongoClient(settings.mongodb_url, serverSelectionTimeoutMS=3000)
    try:
        value = client[settings.mongodb_database].gp_manual_analysis_runs.find_one({"run_id": run_id}, {"_id": False})
        if not value:
            raise HTTPException(status_code=404, detail={"code": "ANALYSIS_RUN_NOT_FOUND", "message": "Analysis run was not found."})
        return {"ok": True, "data": value}
    except HTTPException:
        raise
    except PyMongoError:
        raise HTTPException(status_code=503, detail={"code": "ANALYSIS_STORE_UNAVAILABLE", "message": "Analysis storage is temporarily unavailable."})
    finally:
        client.close()
