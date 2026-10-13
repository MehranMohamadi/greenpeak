"""Offline source-isolation and HTTP tests for Yahoo/Cboe Treasury features."""

import os
from datetime import date, timedelta

os.environ["DEBUG"] = "false"
os.environ["ENVIRONMENT"] = "development"

from fastapi.testclient import TestClient
from pydantic import ValidationError
import pytest

from src.main import app
from src.models.treasury_yield import YahooTreasuryPreviewRequest
from src.services.rate_features.config import get_definition
from src.services.treasury_yield import preview_yahoo_treasury


def test_yahoo_features_use_percent_units_and_separate_source_identity():
    end = date(2026, 10, 12)
    observations = [{"date": (end - timedelta(days=i)).isoformat(), "value": 5.24 - i * .001} for i in range(800)]
    original = get_definition("us_10y_treasury_yield")
    snapshot = preview_yahoo_treasury(YahooTreasuryPreviewRequest(observations=observations), end)
    assert snapshot.indicator_id == "cboe_10y_treasury_yield"
    assert snapshot.source.series_id == "^TNX"
    assert snapshot.current.value == 5.24
    assert snapshot.current.unit == "percent"
    assert snapshot.features["delta_30d_bp"] == pytest.approx(3)
    assert get_definition("us_10y_treasury_yield") == original
    assert original["source"]["series_id"] == "DGS10"


def test_missing_history_remains_null_and_old_yahoo_data_remains_stale():
    snapshot = preview_yahoo_treasury(YahooTreasuryPreviewRequest(observations=[{"date": "2020-01-01", "value": 1.8}]), date(2026, 10, 13))
    assert snapshot.quality.status == "stale"
    assert snapshot.features["delta_30d_bp"] is None
    assert snapshot.features["zscore_365d"] is None


def test_preview_only_accepts_daily_yahoo_tnx_observations():
    for record in [{"date": "bad", "value": 5.24}, {"date": "2026-10-12T10:00:00Z", "value": 5.24}, {"date": "2026-10-12", "value": True}]:
        with pytest.raises(ValidationError):
            YahooTreasuryPreviewRequest(observations=[record])
    with pytest.raises(ValidationError):
        YahooTreasuryPreviewRequest(source_series_id="DGS10", observations=[{"date": "2026-10-12", "value": 5.24}])


def test_http_preview_and_health_without_database_or_external_api():
    client = TestClient(app)
    assert client.get("/health").status_code == 200
    result = client.post("/api/v1/market/treasury-10y/features/preview", json={"source_series_id": "^TNX", "observations": [{"date": "2026-10-12", "value": 5.24}]})
    assert result.status_code == 200
    assert result.json()["data"]["source"]["series_id"] == "^TNX"
    assert result.json()["data"]["current"]["value"] == 5.24
    invalid = client.post("/api/v1/market/treasury-10y/features/preview", json={"source_series_id": "DGS10", "observations": []})
    assert invalid.status_code == 422
