from fastapi import APIRouter, HTTPException
from pymongo import MongoClient
from pymongo.errors import PyMongoError

from ....core.config import get_settings
from ....services.greenpeak_config import load_registry
from ....services.llm_engine.repository import MongoNarrativeRepository
from ....services.llm_engine.schemas import DomainNarrative, IndicatorNarrative, MarketNarrative

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
