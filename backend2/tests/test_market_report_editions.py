"""Offline edition, retention, access and delivery tests; prose is synthetic."""
from copy import deepcopy
from datetime import UTC, date, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import MagicMock, Mock
from zoneinfo import ZoneInfo
import os

os.environ["DEBUG"] = "false"

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from src.core.config import get_settings
from src.services import daily_analysis
from src.services.analysis_access import market_for_access
from src.services.analysis_freshness import market_analysis_freshness
from src.services.analysis_schedule import analysis_slots, market_schedule_window
from src.services.llm_engine import job
from src.services.market_reports import REPORT_TITLES, scope_market_news
from src.utils.telegram import _report_sections, build_telegram_market_report
from test_corporate_valuation_analysis import Provider, Repository

TEHRAN = ZoneInfo("Asia/Tehran")
COVERAGE = {"status": "provisional", "ratio": 0, "configured_count": 11,
            "available_count": 0, "missing_inputs": ["synthetic_fixture"]}


class EditionProvider(Provider):
    def generate_json(self, prompt, request):
        result = super().generate_json(prompt, request)
        self.request = request
        self.prompt = prompt
        if request["contract_level"] == "market":
            prior = request["evidence"].get("previous_report") or {}
            for horizon in ("short", "medium"):
                previous = prior.get(f"{horizon}_term_view")
                result[f"{horizon}_term_view"] = {
                    "summary_fa": f"برداشت آزمایشی {horizon}",
                    "change_condition_fa": "شرط تغییر آزمایشی",
                    "detail_fa": "توضیح شواهد آزمایشی",
                    "change_summary_fa": "بازبینی آزمایشی" if previous else "ارزیابی اولیه آزمایشی",
                    "change_status": "unchanged" if previous else "initial",
                    # Malicious/incorrect timestamps must never be trusted.
                    "assessed_at": "2099-01-01T00:00:00Z",
                }
            result["weekly_focus_fa"] = "موضوع آزمایشی هفته"
            result["weekly_events_fa"] = ["رویداد آزمایشی"]
            result["watch_next_fa"] = ["شرط زیر نظر آزمایشی"]
            if request["evidence"].get("report_kind") == "daily":
                result.pop("medium_term_view")
        return result


@pytest.fixture(autouse=True)
def schedule(monkeypatch):
    settings = get_settings()
    for key, value in {
        "greenpeak_daily_analysis_enabled": True, "greenpeak_daily_analysis_hour": 16,
        "greenpeak_daily_analysis_minute": 0, "greenpeak_daily_analysis_timezone": "Asia/Tehran",
        "greenpeak_market_evening_analysis_enabled": True, "greenpeak_market_evening_analysis_hour": 21,
        "greenpeak_market_evening_analysis_minute": 30, "greenpeak_market_evening_analysis_timezone": "Asia/Tehran",
    }.items():
        monkeypatch.setattr(settings, key, value)


@pytest.mark.parametrize("offset,kind", [(0, "weekly"), (1, "daily"), (2, "daily"),
                                          (3, "daily"), (4, "daily"), (5, "weekend"), (6, "weekend")])
def test_week_has_seven_afternoon_editions_and_only_five_evening_editions(offset, kind):
    day = date(2026, 11, 9) + timedelta(days=offset)
    afternoon, evening = analysis_slots(get_settings())
    assert afternoon.occurs_on(day)
    assert afternoon.report_kind(day) == kind
    assert evening.occurs_on(day) == (offset < 5)
    if offset < 5:
        assert evening.report_kind(day) == "session"


@pytest.mark.parametrize("day", [14, 15])
def test_weekend_freshness_and_next_run_skip_evening(day, monkeypatch):
    now = datetime(2026, 11, day, 22, tzinfo=TEHRAN)
    due, upcoming = market_schedule_window(get_settings(), now)
    assert due == now.replace(hour=16)
    assert upcoming == (now + timedelta(days=1)).replace(hour=16)
    monkeypatch.setattr(daily_analysis, "llm_is_configured", lambda settings: True)
    assert daily_analysis.next_scheduled_analysis_at(now) == upcoming
    assert market_analysis_freshness({"as_of_date": now.date().isoformat(),
        "analysis_generated_at": now.replace(hour=16, minute=5).isoformat()}, now=now)["status"] == "current"


def test_weekend_execution_and_retries_do_not_run_the_evening_or_feature_pipeline(monkeypatch):
    now = datetime(2026, 11, 14, 22, tzinfo=TEHRAN)
    monkeypatch.setattr(daily_analysis, "datetime", SimpleNamespace(now=lambda zone: now.astimezone(zone)))
    client = MagicMock()
    monkeypatch.setattr(daily_analysis, "MongoClient", Mock(return_value=client))
    monkeypatch.setattr(daily_analysis, "_claim_daily_run", lambda *a: True)
    monkeypatch.setattr(daily_analysis, "create_llm_provider", Mock())
    monkeypatch.setattr(daily_analysis, "_deliver_daily_notification", Mock())
    monkeypatch.setattr(daily_analysis, "run_persisted_analysis", Mock(side_effect=AssertionError("no feature rebuild")))
    build = Mock(return_value={"llm": {"market": {"status": "generated"}}, "errors": []})
    monkeypatch.setattr(daily_analysis, "run_persisted_market_analysis", build)
    daily_analysis.run_daily_analysis(slot_id="market-evening")
    daily_analysis.MongoClient.assert_not_called()
    daily_analysis.run_daily_analysis(slot_id="daily")
    assert build.call_args.kwargs["report_kind"] == "weekend"
    assert build.call_count == 1
    calls = Mock()
    monkeypatch.setattr(daily_analysis, "run_daily_analysis", calls)
    daily_analysis.retry_daily_analysis()
    calls.assert_called_once_with(retry_failed=True, slot_id="daily")


def analyze(repository, kind, at, monkeypatch, provider=None, evidence=None):
    monkeypatch.setattr(job, "datetime", SimpleNamespace(now=lambda zone: at.astimezone(zone)))
    provider = provider or EditionProvider()
    value, _ = job._analyze(repository, provider, "market", "sp500", at.date(),
                           {"domain_narratives": [], **(evidence or {}), "report_kind": kind}, COVERAGE,
                           date(2026, 11, 6), True)
    return value.model_dump(mode="json"), provider


def test_editions_preserve_independent_outlooks_factors_and_assessment_dates(monkeypatch):
    repository = Repository()
    weekly, provider = analyze(repository, "weekly", datetime(2026, 11, 9, 16, tzinfo=TEHRAN), monkeypatch)
    assert weekly["analysis_version"] == "0.6.0"
    assert weekly["summary_points_fa"] == []
    assert weekly["medium_term_view"]["assessed_at"].startswith("2026-11-09")
    assert not weekly["medium_term_view"]["assessed_at"].startswith("2099")
    daily, _ = analyze(repository, "daily", datetime(2026, 11, 10, 16, tzinfo=TEHRAN), monkeypatch)
    assert daily["medium_term_view"] == weekly["medium_term_view"]
    assert daily["medium_term_assessed_at"] == weekly["medium_term_assessed_at"]
    assert daily["short_term_assessed_at"] != weekly["short_term_assessed_at"]
    before = deepcopy(repository.documents)
    session, provider = analyze(repository, "session", datetime(2026, 11, 10, 21, 30, tzinfo=TEHRAN), monkeypatch)
    assert "short_term_view" not in provider.request["output_contract"]["properties"]
    assert "market_drivers" not in provider.request["output_contract"]["properties"]
    assert "MANDATORY EDITION SCOPE: session" in provider.prompt
    for key in ("short_term_view", "medium_term_view", "factors_assessed_at", "factor_empty_reasons", "weekly_assessed_at"):
        assert session[key] == daily[key]
    assert repository.documents[:-1] == before
    weekend, _ = analyze(repository, "weekend", datetime(2026, 11, 14, 16, tzinfo=TEHRAN), monkeypatch)
    assert weekend["short_term_view"] == daily["short_term_view"]
    assert weekend["medium_term_view"] == weekly["medium_term_view"]


def test_pulse_can_be_generated_with_no_domains_or_previous_outlooks():
    repository, provider = Repository(), EditionProvider()
    result = job.run_llm_pipeline(None, repository, provider, date(2026, 11, 14),
                                 market_only=True, report_kind="weekend", horizontal_evidence={})
    assert result["errors"] == []
    assert result["market"]["revision_id"]
    saved = repository.latest("market", "sp500")
    assert saved["short_term_view"] is None and saved["medium_term_view"] is None
    assert saved["coverage"]["status"] == "provisional"


def test_legacy_outlook_is_retained_with_its_original_date(monkeypatch):
    repository = Repository()
    old, _ = job._analyze(repository, Provider(), "market", "sp500", date(2026, 11, 8), {}, COVERAGE, None, True)
    pulse, _ = analyze(repository, "session", datetime(2026, 11, 9, 21, 30, tzinfo=TEHRAN), monkeypatch)
    assert pulse["short_term_view"] is None
    assert pulse["short_term_outlook_fa"] == old.short_term_outlook_fa
    assert pulse["short_term_assessed_at"] == old.analysis_generated_at.isoformat().replace("+00:00", "Z")


def test_overlong_pulse_is_repaired_then_rejected_before_storage(monkeypatch):
    repository = Repository()
    provider = EditionProvider()
    generate = provider.generate_json
    def long_output(prompt, request):
        return {**generate(prompt, request), "current_analysis_fa": " ".join(["fixture"] * 80)}
    provider.generate_json = Mock(side_effect=long_output)
    with pytest.raises(ValidationError, match="70-word"):
        analyze(repository, "session", datetime(2026, 11, 9, 21, 30, tzinfo=TEHRAN), monkeypatch, provider)
    assert provider.generate_json.call_count == 2
    assert not repository.documents


def test_daily_length_budget_also_counts_the_visible_review(monkeypatch):
    class LongReviewProvider(EditionProvider):
        def generate_json(self, prompt, request):
            result = super().generate_json(prompt, request)
            result["short_term_view"]["change_summary_fa"] = " ".join(["x"] * 120)
            return result
    repository = Repository()
    with pytest.raises(ValidationError, match="110-word"):
        analyze(repository, "daily", datetime(2026, 11, 10, 16, tzinfo=TEHRAN), monkeypatch, LongReviewProvider())
    assert not repository.documents


@pytest.mark.parametrize("kind", list(REPORT_TITLES))
def test_telegram_only_contains_this_editions_scopes(kind, monkeypatch):
    snapshot, _ = analyze(Repository(), kind, datetime(2026, 11, 9, 16, tzinfo=TEHRAN), monkeypatch)
    # Out-of-scope stored horizons may exist for the website.
    snapshot["short_term_view"] = {"summary_fa": "SHORT_SCOPE", "change_condition_fa": "SHORT_CONDITION", "detail_fa": "SHORT_DETAIL"}
    snapshot["medium_term_view"] = {"summary_fa": "MEDIUM_SCOPE", "detail_fa": "MEDIUM_DETAIL"}
    snapshot["weekly_focus_fa"] = "WEEK_SCOPE"
    snapshot["current_market_move_fa"] = "خبر <آزمایشی>"
    rendered = "\n".join(_report_sections({"market": snapshot}))
    assert REPORT_TITLES[kind] in rendered and "16:00" in rendered
    assert "&lt;آزمایشی&gt;" in rendered
    assert ("SHORT_SCOPE" in rendered) == (kind in {"weekly", "daily"})
    assert ("SHORT_DETAIL" in rendered) == (kind == "weekly")
    assert ("MEDIUM_SCOPE" in rendered) == (kind == "weekly")
    assert ("WEEK_SCOPE" in rendered) == (kind == "weekly")
    assert "جمع‌بندی" not in rendered


def test_new_premium_fields_remain_private_and_public_pulse_stays_available(monkeypatch):
    snapshot, _ = analyze(Repository(), "weekly", datetime(2026, 11, 9, 16, tzinfo=TEHRAN), monkeypatch)
    public = market_for_access(snapshot, False)
    assert public["current_analysis_fa"] == snapshot["current_analysis_fa"]
    for key in ("short_term_view", "medium_term_view", "weekly_focus_fa", "weekly_events_fa"):
        assert key not in public
        assert key in market_for_access(snapshot, True)


def test_api_round_trip_and_health_without_network_or_schedulers(monkeypatch):
    import src.main as main
    from src.api.v1.endpoints import analysis
    from src.api.v1.endpoints.auth import premium_analysis_access, require_debug_access
    snapshot, _ = analyze(Repository(), "weekly", datetime(2026, 11, 9, 16, tzinfo=TEHRAN), monkeypatch)
    monkeypatch.setattr(analysis, "_latest", lambda *args: analysis._validated_response(snapshot, job.MarketNarrative, "fixture"))
    monkeypatch.setattr(analysis, "next_scheduled_analysis_at", lambda: None)
    for factory in ("create_daily_analysis_scheduler", "create_news_scheduler", "create_official_sentiment_scheduler",
                    "create_work_task_notification_scheduler", "create_support_notification_scheduler"):
        monkeypatch.setattr(main, factory, lambda: None)
    app = main.create_app()
    app.dependency_overrides[premium_analysis_access] = lambda: True
    app.dependency_overrides[require_debug_access] = lambda: False
    with TestClient(app) as client:
        assert client.get("/health").status_code == 200
        result = client.get("/api/v1/market/analysis/latest")
        assert result.status_code == 200
        data = result.json()["data"]
        assert data["report_kind"] == "weekly"
        assert data["medium_term_view"]["assessed_at"] == snapshot["medium_term_view"]["assessed_at"]
        assert "provenance" not in data
        app.dependency_overrides[premium_analysis_access] = lambda: False
        data = client.get("/api/v1/market/analysis/latest").json()["data"]
        assert "short_term_view" not in data


def test_telegram_retry_loads_the_exact_revision_instead_of_latest(monkeypatch):
    repo = Mock()
    repo.market_revision.return_value = {"revision_id": "afternoon", "report_kind": "daily"}
    monkeypatch.setattr("src.utils.telegram.MongoNarrativeRepository", lambda *args: repo)
    assert build_telegram_market_report(object(), "fixture", revision_id="afternoon")["market"]["revision_id"] == "afternoon"
    repo.latest.assert_not_called()


def test_notification_retry_is_bound_to_its_saved_revision(monkeypatch):
    from test_daily_analysis import FakeRuns
    runs = FakeRuns({"notification": {"status": "failed", "attempts": 0},
                     "result": {"llm": {"market": {"revision_id": "afternoon"}}}})
    loader = Mock(return_value={"market": {"as_of_date": "2026-11-09"}})
    monkeypatch.setattr(daily_analysis, "build_telegram_market_report", loader)
    monkeypatch.setattr(daily_analysis, "send_telegram_market_report", lambda report: True)
    daily_analysis._deliver_daily_notification(object(), runs, "daily:2026-11-09", date(2026, 11, 9))
    assert loader.call_args.kwargs == {"revision_id": "afternoon"}


def test_weekend_notification_retry_skips_the_evening_slot(monkeypatch):
    now = datetime(2026, 11, 14, 22, tzinfo=TEHRAN)
    monkeypatch.setattr(daily_analysis, "datetime", SimpleNamespace(now=lambda zone: now.astimezone(zone)))
    monkeypatch.setattr(daily_analysis, "MongoClient", Mock(return_value=MagicMock()))
    deliver = Mock()
    monkeypatch.setattr(daily_analysis, "_deliver_daily_notification", deliver)
    daily_analysis.retry_daily_notification()
    assert deliver.call_count == 1
    assert deliver.call_args.args[2] == "daily:2026-11-14"


@pytest.mark.parametrize("kind", list(REPORT_TITLES))
def test_only_dated_same_day_news_can_be_new_pulse_news(kind):
    now = datetime(2026, 11, 14, 16, tzinfo=TEHRAN)
    evidence = {"horizontal_evidence": {"recent_market_news": [
        {"title": "same Tehran day", "published_at": "2026-11-13T21:00:00Z"},
        {"title": "previous Tehran day", "published_at": "2026-11-13T20:00:00Z"},
        {"title": "future", "published_at": "2026-11-14T22:00:00Z"},
        {"title": "invalid", "published_at": "invalid"},
        {"title": "ambiguous zone", "published_at": "2026-11-14T12:00:00"},
    ]}}
    before = deepcopy(evidence)
    scoped = scope_market_news(evidence, kind, now.date(), now)["horizontal_evidence"]
    assert [item["title"] for item in scoped["today_market_news"]] == ["same Tehran day"]
    if kind in {"session", "weekend"}:
        assert scoped["recent_market_news"] == scoped["today_market_news"]
    else:
        assert scoped["recent_market_news"] == evidence["horizontal_evidence"]["recent_market_news"]
    assert evidence == before


def test_sentiment_context_uses_existing_dated_cache_without_refresh(monkeypatch, tmp_path):
    import json
    from src.services import market_analysis_context as context
    from src.services.official_sentiment import OfficialSentimentService
    now = datetime(2026, 11, 14, 12, tzinfo=UTC)
    request = Mock(side_effect=AssertionError("No sentiment refresh during narrative context collection"))
    service = OfficialSentimentService(cache_dir=tmp_path, http_get=request, now=lambda: now)
    payload = {"data": [{"date": "2026-11-12", "value": 0.5}], "metadata": {
        "indicator_id": "spx_put_call_ratio", "observation_date": "2026-11-12",
        "frequency": "daily", "source": "fixture", "quality_status": "available",
    }}
    path = tmp_path / "spx_put_call_ratio.json"
    path.write_text(json.dumps({"fetched_at": "2026-11-12T20:00:00+00:00", "payload": payload}), encoding="utf-8")
    original = path.read_bytes()
    monkeypatch.setattr(context, "official_sentiment_service", service)
    monkeypatch.setattr(context, "fetch_sp500_session_move", lambda *a: {})
    monkeypatch.setattr(context, "_recent_news", lambda *a: [])
    monkeypatch.setattr(context, "fetch_upcoming_us_events", lambda **kw: [])
    monkeypatch.setattr(context, "fetch_recent_us_events", lambda **kw: [])
    result = context.build_market_analysis_context(object(), "fixture", now.date(), now)
    observed = result["sentiment_observations"][0]
    assert observed["metadata"]["observation_date"] == "2026-11-12"
    assert observed["metadata"]["frequency"] == "daily"
    assert "not a live sentiment" in observed["usage"]
    request.assert_not_called()
    assert path.read_bytes() == original


@pytest.mark.parametrize("source_ref,material,status,accepted", [
    ("/domain_narratives/0", True, "changed", True),
    ("/domain_narratives/0", False, "changed", False),
    ("/domain_narratives/0", True, "unchanged", False),
    ("/domain_narratives/9", True, "changed", False),
    ("/retained_factor_evidence/old", True, "changed", False),
])
def test_only_evidenced_material_changes_trigger_an_exceptional_daily_medium_term_review(monkeypatch, source_ref, material, status, accepted):
    repository = Repository()
    weekly, _ = analyze(repository, "weekly", datetime(2026, 11, 9, 16, tzinfo=TEHRAN), monkeypatch)
    class ChangedProvider(EditionProvider):
        def generate_json(self, prompt, request):
            result = super().generate_json(prompt, request)
            result["medium_term_view"] = {**weekly["medium_term_view"],
                "material_change": material, "change_status": status,
                "change_summary_fa": "تغییر مهم آزمایشی با شواهد تازه", "evidence_refs": [source_ref]}
            return result
    evidence = {"domain_narratives": [{"as_of_date": "2026-11-10", "narrative_fa": "شواهد تازه آزمایشی"}],
                "retained_factor_evidence": {"old": {"narrative_fa": "منبع قدیمی"}}}
    if not accepted:
        with pytest.raises(ValidationError):
            analyze(repository, "daily", datetime(2026, 11, 10, 16, tzinfo=TEHRAN), monkeypatch, ChangedProvider(), evidence)
        assert len(repository.documents) == 1
        return
    daily, _ = analyze(repository, "daily", datetime(2026, 11, 10, 16, tzinfo=TEHRAN), monkeypatch, ChangedProvider(), evidence)
    assert daily["medium_term_reassessed"] is True
    assert daily["medium_term_view"]["assessed_at"] != weekly["medium_term_view"]["assessed_at"]
    assert "بازنگری مهم میان‌مدت" in "\n".join(_report_sections(daily))
    session, _ = analyze(repository, "session", datetime(2026, 11, 10, 21, 30, tzinfo=TEHRAN), monkeypatch)
    assert session["medium_term_view"] == daily["medium_term_view"]
    assert session["medium_term_reassessed"] is False
