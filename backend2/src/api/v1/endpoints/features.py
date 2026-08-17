"""Read-only access to stored and development-preview indicator features."""

from datetime import UTC, date, datetime
import json
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from pymongo import MongoClient
from pymongo.errors import PyMongoError

from ....core.config import get_settings
from ....services.rate_features.config import DEFINITIONS
from ....services.rate_features.builder import build_snapshot
from ....services.rate_features.cleaning import adapt_mongo_documents, clean_observations
from ....services.rate_features.config import get_definition
from ....services.rate_features.job import code_version
from ....services.rate_features.repository import MongoFeatureRepository
from ....services.rate_features.schemas import IndicatorFeatureSnapshot

router = APIRouter(prefix="/indicators", tags=["Indicator Features"])


def _require_preview_enabled() -> None:
    if not get_settings().greenpeak_enable_pipeline_preview:
        raise HTTPException(status_code=404, detail={"code": "PIPELINE_PREVIEW_DISABLED", "message": "Pipeline preview is disabled in this environment."})


class PipelinePreviewObservation(BaseModel):
    date: str
    value: Any


class PipelinePreviewRequest(BaseModel):
    indicator_id: str
    source_series_id: str
    source_provider: str = "GreenPeak existing API"
    observations: list[PipelinePreviewObservation] = Field(min_length=1, max_length=10_000)


def _json_records(frame, limit: int = 10) -> list[dict]:
    if frame.empty:
        return []
    return json.loads(frame.tail(limit).to_json(orient="records", date_format="iso"))


def _safe_raw_document(document: dict) -> dict:
    metadata = document.get("metadata") or {}
    return {
        "raw_document_id": str(document.get("_id")) if document.get("_id") is not None else None,
        "date": document.get("date"),
        "indicator": document.get("indicator"),
        "value": document.get("value"),
        "fred_series_id": document.get("fred_series_id"),
        "updated_at": document.get("updated_at"),
        "metadata": {
            "frequency": metadata.get("frequency"),
            "unit": metadata.get("unit"),
            "source": metadata.get("source"),
        },
    }


def _build_pipeline_stages(indicator_id: str, definition: dict, raw_documents: list[dict], target_date: date, source_stage: str) -> dict:
    canonical = adapt_mongo_documents(raw_documents, indicator_id)
    cleaned, cleaning_flags, received_count = clean_observations(canonical, target_date)
    snapshot, _ = build_snapshot(
        definition,
        canonical,
        target_date,
        run_id=f"debug:{uuid4()}",
        code_version=code_version(),
        calculated_at=datetime.now(UTC),
    )
    if snapshot is None:
        raise HTTPException(status_code=422, detail={"code": "NO_VALID_OBSERVATIONS", "message": "No valid observations are available for this preview."})
    payload = snapshot.model_dump(mode="json")
    return {
        "indicator_id": indicator_id,
        "as_of_date": target_date,
        "source_stage": source_stage,
        "pipeline": ["raw_input", "canonical_adapter", "cleaned_series", "calculated_features", "validated_snapshot"],
        "stages": {
            "raw_input": {"description": f"Read-only observations received from {source_stage}.", "total_count": len(raw_documents), "sample_last_10": [_safe_raw_document(item) for item in raw_documents[-10:]]},
            "canonical_adapter": {"description": "Raw fields mapped to the canonical internal contract.", "total_count": len(canonical), "sample_last_10": _json_records(canonical)},
            "cleaned_series": {"description": "Valid, sorted, de-duplicated observations used by calculations.", "received_count": received_count, "valid_count": len(cleaned), "flags": cleaning_flags, "sample_last_10": _json_records(cleaned)},
            "calculated_features": {"description": "Deterministic Python output; rate changes are basis points.", "features": payload["features"], "feature_reasons": payload["feature_reasons"], "derived_features": payload["derived_features"], "state": payload["state"], "quality": payload["quality"]},
            "validated_snapshot": {"description": "Final Pydantic-validated, versioned snapshot before persistence.", "snapshot": payload},
        },
    }


@router.get("/{indicator_id}/features/latest")
def latest_indicator_features(indicator_id: str, mode: str | None = Query(None, pattern="^(debug)?$")):
    if indicator_id not in DEFINITIONS:
        raise HTTPException(status_code=404, detail={"code": "INDICATOR_NOT_FOUND", "message": "Unknown feature indicator."})
    settings = get_settings()
    client = MongoClient(settings.mongodb_url, serverSelectionTimeoutMS=3000)
    try:
        document = MongoFeatureRepository(client, settings.mongodb_database).latest_snapshot(indicator_id)
        if not document:
            raise HTTPException(status_code=404, detail={"code": "FEATURE_SNAPSHOT_NOT_FOUND", "message": "No feature snapshot is available for this indicator."})
        snapshot = IndicatorFeatureSnapshot.model_validate(document)
        payload = snapshot.model_dump(mode="json")
        if mode != "debug":
            payload = {key: payload[key] for key in ("indicator_id", "as_of_date", "source", "current", "features", "feature_reasons", "derived_features", "state", "quality", "semantics", "llm_context")}
        return {"ok": True, "data": payload}
    except HTTPException:
        raise
    except PyMongoError:
        raise HTTPException(status_code=503, detail={"code": "FEATURE_STORE_UNAVAILABLE", "message": "Feature storage is temporarily unavailable."})
    finally:
        client.close()


@router.get("/{indicator_id}/features/pipeline-debug")
def indicator_feature_pipeline_debug(indicator_id: str, as_of: date | None = None):
    """Return sampled intermediate stages; available only outside production."""
    _require_preview_enabled()
    settings = get_settings()
    if indicator_id not in DEFINITIONS:
        raise HTTPException(status_code=404, detail={"code": "INDICATOR_NOT_FOUND", "message": "Unknown feature indicator."})

    target_date = as_of or date.today()
    definition = get_definition(indicator_id)
    definition["indicator_id"] = indicator_id
    client = MongoClient(settings.mongodb_url, serverSelectionTimeoutMS=3000)
    try:
        repository = MongoFeatureRepository(client, settings.mongodb_database)
        raw_documents = repository.load_raw_documents(definition, target_date)
        return {"ok": True, "data": _build_pipeline_stages(indicator_id, definition, raw_documents, target_date, "mongodb:monetary_policy")}
    except HTTPException:
        raise
    except PyMongoError:
        raise HTTPException(status_code=503, detail={"code": "FEATURE_STORE_UNAVAILABLE", "message": "MongoDB is unavailable; start it to inspect real pipeline data."})
    finally:
        client.close()


@router.post("/features/pipeline-preview")
def indicator_feature_pipeline_preview(request: PipelinePreviewRequest, as_of: date | None = None):
    """Build development stages from existing API observations without persisting them."""
    _require_preview_enabled()
    settings = get_settings()
    if request.indicator_id not in DEFINITIONS:
        raise HTTPException(status_code=404, detail={"code": "INDICATOR_NOT_FOUND", "message": "Unknown feature indicator."})
    definition = get_definition(request.indicator_id)
    definition["indicator_id"] = request.indicator_id
    expected_series = definition["source"]["series_id"]
    if request.source_series_id != expected_series:
        raise HTTPException(status_code=422, detail={"code": "SERIES_MISMATCH", "message": f"Expected source series {expected_series}."})
    target_date = as_of or date.today()
    raw_documents = [
        {
            "date": item.date,
            "indicator": definition["raw_indicator"],
            "value": item.value,
            "fred_series_id": request.source_series_id,
            "updated_at": None,
            "metadata": {"frequency": definition["data"]["frequency"], "unit": "Percent", "source": request.source_provider},
        }
        for item in request.observations
    ]
    return {"ok": True, "data": _build_pipeline_stages(request.indicator_id, definition, raw_documents, target_date, "existing_api_fallback")}
