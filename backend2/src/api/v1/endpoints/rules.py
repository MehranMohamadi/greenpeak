from fastapi import APIRouter, HTTPException
from pymongo import MongoClient
from pymongo.errors import PyMongoError

from ....core.config import get_settings
from ....services.rule_engine.repository import MongoRuleRepository

router = APIRouter(prefix="/rules", tags=["Persisted GreenPeak Rules"])


@router.get("/{level}/{subject_id}/latest")
def latest_rule_result(level: str, subject_id: str):
    if level not in {"domain", "market"}:
        raise HTTPException(status_code=404, detail={"code": "RULE_LEVEL_NOT_FOUND", "message": "Unknown rule level."})
    settings = get_settings(); client = MongoClient(settings.mongodb_url, serverSelectionTimeoutMS=3000)
    try:
        value = MongoRuleRepository(client, settings.mongodb_database).latest(level, subject_id)
        if not value:
            raise HTTPException(status_code=404, detail={"code": "RULE_RESULT_NOT_GENERATED", "message": "Rule result has not been generated yet."})
        return {"ok": True, "data": value}
    except HTTPException:
        raise
    except PyMongoError:
        raise HTTPException(status_code=503, detail={"code": "RULE_STORE_UNAVAILABLE", "message": "Rule storage is temporarily unavailable."})
    finally:
        client.close()
