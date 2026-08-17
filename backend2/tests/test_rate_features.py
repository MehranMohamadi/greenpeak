"""Offline tests for GreenPeak Technical Step 1 rate features."""

import os
from datetime import UTC, date, datetime, timedelta

os.environ["DEBUG"] = "false"
os.environ["ENVIRONMENT"] = "development"

import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from src.services.rate_features.builder import build_snapshot
from src.services.rate_features.cleaning import adapt_mongo_documents, clean_observations
from src.services.rate_features.config import get_definition
from src.services.rate_features.engine import calculate_fed_change, calculate_pair_features, calculate_rate_features
from src.services.rate_features.job import run_feature_job
from src.main import app
from src.services.rate_features.repository import MongoFeatureRepository
from src.services.data_service import DataService


def canonical(values, start=date(2024, 1, 1), indicator="test"):
    return pd.DataFrame([{
        "indicator_id": indicator, "observation_date": start + timedelta(days=index), "value_pct": value,
        "source_provider": "fixture", "source_series_id": "FIXTURE", "ingested_at": pd.Timestamp("2026-01-01", tz="UTC"),
        "raw_document_id": str(index), "is_valid": True, "validation_flags": [],
    } for index, value in enumerate(values)])


def test_unit_conversion_and_weekend_historical_lookup():
    frame = canonical([4.0, 4.25], start=date(2024, 1, 5))
    frame.loc[1, "observation_date"] = date(2024, 1, 8)
    config = get_definition("us_10y_treasury_yield")["feature_config"]
    config["calendar_offsets_days"] = [2]
    features, _, _ = calculate_rate_features(frame, config, date(2024, 1, 8))
    assert features["delta_2d_bp"] == pytest.approx(25.0)


def test_dot_null_and_duplicate_latest_valid_ingestion():
    documents = [
        {"_id": 1, "date": "2024-01-01", "value": ".", "updated_at": "2024-01-01T01:00:00Z", "fred_series_id": "DFF"},
        {"_id": 2, "date": "2024-01-02", "value": 4.0, "updated_at": "2024-01-02T01:00:00Z", "fred_series_id": "DFF"},
        {"_id": 3, "date": "2024-01-02", "value": 4.25, "updated_at": "2024-01-02T02:00:00Z", "fred_series_id": "DFF"},
    ]
    raw = adapt_mongo_documents(documents, "federal_funds_rate")
    clean, flags, received = clean_observations(raw, date(2024, 1, 3))
    assert received == 3
    assert clean.value_pct.tolist() == [4.25]
    assert flags == ["duplicate_dates:1"]
    assert raw.iloc[0].validation_flags == ["invalid_value"]


def test_zscore_percentile_slope_and_volatility_known_fixture():
    frame = canonical([float(item) for item in range(1, 121)])
    config = get_definition("us_10y_treasury_yield")["feature_config"]
    config["minimum_observation_counts"] = {key: 2 for key in config["minimum_observation_counts"]}
    features, reasons, _ = calculate_rate_features(frame, config, frame.observation_date.iloc[-1])
    values = np.arange(1.0, 121.0)
    assert features["zscore_365d"] == pytest.approx((120 - values.mean()) / values.std(ddof=0))
    assert features["percentile_5y"] == pytest.approx((119 + 0.5) / 120 * 100)
    assert features["slope_90d_bp_per_30d"] == pytest.approx(3000.0)
    assert features["volatility_90d_bp"] == pytest.approx(0.0)
    assert reasons == {"delta_180d_bp": "insufficient_history", "delta_365d_bp": "insufficient_history"}


def test_zero_variance_and_insufficient_history_are_explicit():
    frame = canonical([4.0] * 120)
    config = get_definition("federal_funds_rate")["feature_config"]
    config["minimum_observation_counts"] = {key: 2 for key in config["minimum_observation_counts"]}
    features, reasons, direction = calculate_rate_features(frame, config, frame.observation_date.iloc[-1])
    assert features["zscore_365d"] is None
    assert reasons["zscore_365d"] == "zero_variance"
    assert direction == "stable"

    short_features, short_reasons, _ = calculate_rate_features(frame.iloc[:1], get_definition("federal_funds_rate")["feature_config"], frame.observation_date.iloc[0])
    assert short_features["delta_365d_bp"] is None
    assert short_reasons["delta_365d_bp"] == "insufficient_history"


def test_fed_last_change_and_cross_spread_common_dates():
    fed = canonical([5.0, 5.0, 5.25], start=date(2024, 1, 1), indicator="federal_funds_rate")
    change, _ = calculate_fed_change(fed, date(2024, 1, 10))
    assert change == {"last_change_date": "2024-01-03", "last_change_bp": pytest.approx(25), "days_since_last_change": 7}

    ten = canonical([4.0, 4.2], start=date(2024, 1, 1), indicator="us_10y_treasury_yield").iloc[[0, 1]]
    fed = fed.iloc[[0, 2]]
    pair, reasons = calculate_pair_features(ten, fed, date(2024, 1, 10))
    assert pair["spread_common_date"] == "2024-01-01"
    assert pair["spread_to_fed_funds_bp"] == pytest.approx(-100)
    assert reasons["spread_delta_90d_bp"] == "insufficient_history"


def test_snapshot_quality_stale_schema_and_determinism():
    definition = get_definition("us_10y_treasury_yield"); definition["indicator_id"] = "us_10y_treasury_yield"
    frame = canonical([4 + index / 1000 for index in range(600)], start=date(2023, 1, 1), indicator="us_10y_treasury_yield")
    calculated = datetime(2026, 1, 1, tzinfo=UTC)
    latest_date = frame.observation_date.iloc[-1]
    first, _ = build_snapshot(definition, frame, latest_date, "run", "git:test", calculated)
    second, _ = build_snapshot(definition, frame, latest_date, "run", "git:test", calculated)
    assert first == second
    assert first.quality.status == "ok"
    stale, _ = build_snapshot(definition, frame, latest_date + timedelta(days=8), "run", "git:test", calculated)
    assert stale.quality.status == "stale"
    assert stale.features["mean_30d_pct"] is not None
    assert stale.features["zscore_365d"] is not None
    assert stale.features == first.features


def test_ten_year_fallback_is_daily_not_monthly_gs10():
    service = DataService.__new__(DataService)
    service.mongodb = None
    response = service.get_10year_data(start_date="2024-01-01")
    assert response.metadata.fred_series == "DGS10"
    assert response.metadata.frequency == "daily"
    assert len(response.data) > 200
    assert response.data[-1].date == "2025-07-08"
    assert response.data[-1].value == pytest.approx(4.42)


class FakeRepository:
    def __init__(self, frames):
        self.frames = frames; self.snapshots = {}; self.runs = []
    def load_observations(self, definition, as_of): return self.frames[definition["indicator_id"]]
    def ensure_indexes(self): pass
    def save_definition(self, definition): pass
    def save_snapshot(self, snapshot):
        key = (snapshot["indicator_id"], snapshot["as_of_date"], snapshot["feature_version"], snapshot["definition_version"])
        if key in self.snapshots: return "already_exists"
        self.snapshots[key] = snapshot; return "inserted"
    def save_run(self, run): self.runs.append(run)
    def latest_snapshot(self, indicator_id):
        matches = [item for key, item in self.snapshots.items() if key[0] == indicator_id]
        return max(matches, key=lambda item: (item["as_of_date"], item["calculated_at"])) if matches else None


def test_offline_vertical_slice_and_idempotency():
    start = date(2023, 1, 1)
    frames = {
        "us_10y_treasury_yield": canonical([4 + index / 2000 for index in range(700)], start, "us_10y_treasury_yield"),
        "federal_funds_rate": canonical([5 if index < 500 else 5.25 for index in range(700)], start, "federal_funds_rate"),
    }
    repository = FakeRepository(frames)
    ids = list(frames)
    snapshots, first_run = run_feature_job(repository, ids, date(2024, 11, 30), True)
    assert first_run.status == "success" and first_run.counts["written"] == 2
    treasury = next(item for item in snapshots if item["indicator_id"] == "us_10y_treasury_yield")
    assert treasury["derived_features"]["spread_common_date"] == "2024-11-30"
    _, second_run = run_feature_job(repository, ids, date(2024, 11, 30), True)
    assert second_run.counts["written"] == 0
    assert len(repository.snapshots) == 2
    assert repository.latest_snapshot("federal_funds_rate")["indicator_id"] == "federal_funds_rate"


def test_latest_snapshot_endpoint(monkeypatch):
    definition = get_definition("federal_funds_rate"); definition["indicator_id"] = "federal_funds_rate"
    frame = canonical([5 + index / 10000 for index in range(700)], date(2023, 1, 1), "federal_funds_rate")
    snapshot, _ = build_snapshot(definition, frame, frame.observation_date.iloc[-1], "run", "git:test")
    document = snapshot.model_dump(mode="json")
    monkeypatch.setattr(MongoFeatureRepository, "latest_snapshot", lambda self, indicator_id: document)
    response = TestClient(app).get("/api/v1/indicators/federal_funds_rate/features/latest")
    assert response.status_code == 200
    assert response.json()["data"]["source"]["series_id"] == "DFF"
    assert "provenance" not in response.json()["data"]
    assert TestClient(app).get("/api/v1/indicators/not-valid/features/latest").status_code == 404


def test_pipeline_debug_endpoint_returns_ordered_stages(monkeypatch):
    from src.core.config import get_settings
    monkeypatch.setattr(get_settings(), "greenpeak_enable_pipeline_preview", True)
    documents = [
        {"_id": index, "date": f"2024-01-{index:02d}", "indicator": "federal_funds_rate", "value": 5.25,
         "fred_series_id": "DFF", "updated_at": datetime(2024, 1, index, tzinfo=UTC),
         "metadata": {"frequency": "Daily", "unit": "Percent", "source": "FRED"}}
        for index in range(1, 11)
    ]
    monkeypatch.setattr(MongoFeatureRepository, "load_raw_documents", lambda self, definition, as_of_date: documents)
    response = TestClient(app).get("/api/v1/indicators/federal_funds_rate/features/pipeline-debug?as_of=2024-01-10")
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["pipeline"] == ["raw_input", "canonical_adapter", "cleaned_series", "calculated_features", "validated_snapshot"]
    assert data["stages"]["raw_input"]["total_count"] == 10
    assert data["stages"]["canonical_adapter"]["sample_last_10"][0]["source_series_id"] == "DFF"
    assert data["stages"]["validated_snapshot"]["snapshot"]["source"]["series_id"] == "DFF"


def test_pipeline_preview_accepts_existing_api_shape(monkeypatch):
    from src.core.config import get_settings
    monkeypatch.setattr(get_settings(), "greenpeak_enable_pipeline_preview", True)
    observations = [{"date": (date(2024, 1, 1) + timedelta(days=index)).isoformat(), "value": 5.25} for index in range(120)]
    response = TestClient(app).post(
        "/api/v1/indicators/features/pipeline-preview?as_of=2024-04-29",
        json={"indicator_id": "federal_funds_rate", "source_series_id": "DFF", "observations": observations},
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["source_stage"] == "existing_api_fallback"
    assert data["stages"]["raw_input"]["total_count"] == 120
    assert data["stages"]["calculated_features"]["features"]["current_value_pct"] == 5.25

    mismatch = TestClient(app).post(
        "/api/v1/indicators/features/pipeline-preview",
        json={"indicator_id": "federal_funds_rate", "source_series_id": "FEDFUNDS", "observations": observations[:1]},
    )
    assert mismatch.status_code == 422


def test_pipeline_preview_is_disabled_by_default(monkeypatch):
    from src.core.config import get_settings
    monkeypatch.setattr(get_settings(), "greenpeak_enable_pipeline_preview", False)
    response = TestClient(app).post("/api/v1/indicators/features/pipeline-preview", json={"indicator_id": "federal_funds_rate", "source_series_id": "DFF", "observations": [{"date": "2024-01-01", "value": 5.25}]})
    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "PIPELINE_PREVIEW_DISABLED"
