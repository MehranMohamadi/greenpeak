import os
from datetime import UTC, date, datetime

import pytest
from fastapi import HTTPException
from pymongo.errors import ServerSelectionTimeoutError

os.environ["DEBUG"] = "false"

from src.api.v1.endpoints import analysis
from src.core.config import get_settings
from src.services.llm_engine.local_cache import LocalNarrativeCache
from src.services.llm_engine.schemas import MarketNarrative


def _market_snapshot() -> dict:
    return {
        "level": "market",
        "subject_id": "sp500",
        "as_of_date": date(2026, 9, 22),
        "data_as_of": date(2026, 9, 21),
        "analysis_generated_at": datetime(2026, 9, 22, 8, 0, tzinfo=UTC),
        "narrative_fa": "روایت معتبر ذخیره‌شده",
        "market_story_fa": "داستان بازار",
        "coverage": {
            "status": "partial",
            "ratio": 0.5,
            "configured_count": 2,
            "available_count": 1,
            "missing_inputs": ["sample"],
        },
        "evidence_refs": [],
        "provenance": {
            "prompt_version": "test",
            "prompt_hash": "prompt-hash",
            "model": "test-model",
            "provider": "test-provider",
            "input_hash": "input-hash",
            "code_version": "test",
        },
        "warnings": [],
        "revision_id": "revision-1",
    }


class _UnavailableRepository:
    def __init__(self, *_args, **_kwargs):
        pass

    def latest(self, *_args, **_kwargs):
        raise ServerSelectionTimeoutError("offline")


class _AvailableRepository:
    def __init__(self, *_args, **_kwargs):
        pass

    def latest(self, *_args, **_kwargs):
        return _market_snapshot()


class _Client:
    def close(self):
        pass


def _configure_local_cache(monkeypatch, tmp_path):
    settings = get_settings()
    monkeypatch.setattr(settings, "environment", "development")
    monkeypatch.setattr(settings, "analysis_local_fallback_enabled", True)
    monkeypatch.setattr(settings, "analysis_local_db_path", tmp_path / "analysis.db")
    monkeypatch.setattr(analysis, "MongoClient", lambda *_args, **_kwargs: _Client())
    monkeypatch.setattr(analysis, "MongoNarrativeRepository", _UnavailableRepository)
    return settings


def test_local_cache_round_trips_validated_snapshot(tmp_path):
    cache = LocalNarrativeCache(tmp_path / "analysis.db")
    snapshot = MarketNarrative.model_validate(_market_snapshot()).model_dump(mode="json")
    cache.save("market", "sp500", snapshot)
    assert cache.latest("market", "sp500") == snapshot


def test_latest_uses_local_cache_when_mongodb_is_offline(monkeypatch, tmp_path):
    settings = _configure_local_cache(monkeypatch, tmp_path)
    cache = LocalNarrativeCache(settings.analysis_local_db_path)
    cache.save("market", "sp500", _market_snapshot())

    response = analysis._latest("market", "sp500", MarketNarrative)

    assert response["ok"] is True
    assert response["metadata"]["storage"] == "local_cache"
    assert response["data"]["market_story_fa"] == "داستان بازار"


def test_latest_mongodb_response_populates_local_cache(monkeypatch, tmp_path):
    settings = _configure_local_cache(monkeypatch, tmp_path)
    monkeypatch.setattr(analysis, "MongoNarrativeRepository", _AvailableRepository)

    response = analysis._latest("market", "sp500", MarketNarrative)

    assert response["metadata"]["storage"] == "mongodb"
    cached = LocalNarrativeCache(settings.analysis_local_db_path).latest("market", "sp500")
    assert cached is not None
    assert cached["market_story_fa"] == "داستان بازار"


def test_latest_returns_not_generated_without_mongo_or_cache(monkeypatch, tmp_path):
    _configure_local_cache(monkeypatch, tmp_path)

    with pytest.raises(HTTPException) as error:
        analysis._latest("market", "sp500", MarketNarrative)

    assert error.value.status_code == 404
    assert error.value.detail["code"] == "ANALYSIS_NOT_GENERATED"


def test_production_keeps_store_unavailable_response(monkeypatch, tmp_path):
    settings = _configure_local_cache(monkeypatch, tmp_path)
    monkeypatch.setattr(settings, "environment", "production")

    with pytest.raises(HTTPException) as error:
        analysis._latest("market", "sp500", MarketNarrative)

    assert error.value.status_code == 503
    assert error.value.detail["code"] == "ANALYSIS_STORE_UNAVAILABLE"
