"""Focused tests for the deterministic analysis preparation pipeline."""

import os
from datetime import datetime, timezone
from math import inf, nan

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

os.environ["DEBUG"] = "false"
os.environ["ENVIRONMENT"] = "development"

from src.main import app
from src.models.analysis_schemas import AnalysisRequest, MetricInput, NewsInput
from src.services.analysis import AnalysisService


AS_OF = datetime(2026, 8, 3, 12, tzinfo=timezone.utc)


def metric(value: float, unit: str = "percent") -> dict:
    return {
        "type": "metric", "id": "fed_funds_rate", "title": "Federal Funds Rate",
        "value": value, "unit": unit, "timestamp": "2026-08-03T00:00:00Z", "source": "FRED",
    }


@pytest.mark.parametrize(
    ("value", "unit", "expected"),
    [(3.65, "percent", 0.0365), (25, "basis_point", 0.0025), (0.0365, "decimal", 0.0365)],
)
def test_metric_normalization(value, unit, expected):
    result = AnalysisService().prepare(AnalysisRequest(as_of=AS_OF, items=[metric(value, unit)]))
    assert result.normalized_items[0]["value"] == value
    assert result.normalized_items[0]["normalized_value"] == expected


@pytest.mark.parametrize("value", [nan, inf, -inf])
def test_non_finite_values_are_rejected(value):
    with pytest.raises(ValidationError):
        MetricInput(**metric(value))


def test_time_series_is_sorted_and_zero_previous_value_is_safe():
    request = AnalysisRequest(as_of=AS_OF, items=[{
        "type": "time_series", "id": "series", "title": "Series", "unit": "index",
        "points": [
            {"timestamp": "2026-08-02T00:00:00Z", "value": 5},
            {"timestamp": "2026-08-01T00:00:00Z", "value": 0},
        ],
    }])
    result = AnalysisService().prepare(request)
    assert [point["value"] for point in result.normalized_items[0]["points"]] == [0, 5]
    assert result.features["series"]["percent_change"] is None


def test_news_symbols_do_not_share_mutable_default():
    first = NewsInput(id="one", title="One", published_at=AS_OF, source="source")
    second = NewsInput(id="two", title="Two", published_at=AS_OF, source="source")
    first.symbols.append("SPY")
    assert second.symbols == []


def test_interest_rate_rule_produces_medium_signal():
    result = AnalysisService().prepare(AnalysisRequest(as_of=AS_OF, items=[metric(3.65)]))
    assert result.signals[0].severity == "medium"
    assert result.signals[0].evidence_ids == ["fed_funds_rate"]
    assert result.signals[0].metrics == {"percent": 3.65, "decimal": 0.0365}


def test_prepare_endpoint_and_invalid_unit():
    client = TestClient(app)
    payload = {"market": "SP500", "as_of": "2026-08-03T12:00:00Z", "items": [metric(3.65)]}
    response = client.post("/api/v1/analysis/prepare", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert body["data"]["normalized_items"][0]["display_value"] == "3.65%"
    assert body["data"]["signals"][0]["severity"] == "medium"
    assert set(body) == {"data", "metadata"}

    payload["items"][0]["unit"] = "invalid"
    assert client.post("/api/v1/analysis/prepare", json=payload).status_code == 422
