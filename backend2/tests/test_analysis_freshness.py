"""Daily narrative freshness must reflect Tehran time and actual generation."""

from copy import deepcopy
from datetime import UTC, datetime
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient

from src.api.v1.endpoints import analysis
from src.core.config import get_settings
from src.main import app
from src.services.analysis_freshness import market_analysis_freshness


TEHRAN = ZoneInfo("Asia/Tehran")


@pytest.fixture(autouse=True)
def configured_schedule(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "greenpeak_daily_analysis_enabled", True)
    monkeypatch.setattr(settings, "greenpeak_daily_analysis_hour", 16)
    monkeypatch.setattr(settings, "greenpeak_daily_analysis_minute", 0)
    monkeypatch.setattr(settings, "greenpeak_daily_analysis_timezone", "Asia/Tehran")


def snapshot(day="2026-10-15", generated="2026-10-15T12:34:34Z"):
    return {"as_of_date": day, "analysis_generated_at": generated, "data_as_of": "2026-10-14"}


def test_yesterdays_analysis_is_overdue_after_todays_scheduled_time():
    document = snapshot()
    original = deepcopy(document)
    freshness = market_analysis_freshness(document, now=datetime(2026, 10, 16, 18, 41, tzinfo=TEHRAN))
    assert freshness["status"] == "overdue"
    assert freshness["is_stale"] is True
    assert freshness["expected_as_of_date"] == "2026-10-16"
    assert freshness["scheduled_for"] == "2026-10-16T16:00:00+03:30"
    assert document == original


def test_previous_analysis_is_expected_before_todays_run():
    freshness = market_analysis_freshness(snapshot(), now=datetime(2026, 10, 16, 15, 59, tzinfo=TEHRAN))
    assert freshness["status"] == "scheduled"
    assert freshness["is_stale"] is False
    assert freshness["expected_as_of_date"] == "2026-10-15"


def test_two_day_old_analysis_is_stale_even_before_todays_run():
    freshness = market_analysis_freshness(snapshot("2026-10-14", "2026-10-14T13:00:00Z"), now=datetime(2026, 10, 16, 12, tzinfo=TEHRAN))
    assert freshness["status"] == "overdue"


def test_fresh_narrative_can_use_older_observations():
    freshness = market_analysis_freshness(snapshot("2026-10-16", "2026-10-16T12:34:34Z"), now=datetime(2026, 10, 16, 18, tzinfo=TEHRAN))
    assert freshness["status"] == "current"
    assert freshness["is_stale"] is False


def test_calendar_boundary_uses_tehran_instead_of_utc_date():
    now = datetime(2026, 10, 16, 21, 30, tzinfo=UTC)
    freshness = market_analysis_freshness(snapshot("2026-10-16", "2026-10-16T13:00:00Z"), now=now)
    assert freshness["status"] == "scheduled"
    assert freshness["scheduled_for"].startswith("2026-10-17")


@pytest.mark.parametrize("document", [
    {}, snapshot(generated="bad-date"), snapshot("2026-10-17", "2026-10-17T12:00:00Z"),
])
def test_missing_or_future_provenance_is_not_labelled_current(document):
    freshness = market_analysis_freshness(document, now=datetime(2026, 10, 16, 18, tzinfo=TEHRAN))
    assert freshness["status"] == "unknown"
    assert freshness["is_stale"] is True


def test_disabled_scheduler_does_not_promise_an_update(monkeypatch):
    monkeypatch.setattr(get_settings(), "greenpeak_daily_analysis_enabled", False)
    freshness = market_analysis_freshness(snapshot(), now=datetime(2026, 10, 16, 18, tzinfo=TEHRAN))
    assert freshness["status"] == "outdated"
    assert freshness["scheduled_for"] is None


def test_latest_read_exposes_freshness_without_generating_analysis(monkeypatch):
    document = {**snapshot("2000-01-01", "2000-01-01T12:00:00Z"), "current_analysis_fa": "Stored flow"}
    monkeypatch.setattr(analysis, "_latest", lambda *args: {"ok": True, "data": deepcopy(document)})
    monkeypatch.setattr(analysis, "next_scheduled_analysis_at", lambda: None)
    monkeypatch.setattr(analysis, "run_persisted_analysis", lambda *args, **kwargs: pytest.fail("A page read must not run the LLM pipeline"))
    response = TestClient(app).get("/api/v1/market/analysis/latest")
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert response.json()["metadata"]["freshness"]["is_stale"] is True
    assert response.json()["data"]["analysis_generated_at"] == document["analysis_generated_at"]
    assert response.json()["data"]["current_analysis_fa"] == "Stored flow"
