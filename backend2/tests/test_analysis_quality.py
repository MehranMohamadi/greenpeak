"""Offline quality lifecycle: immutable evidence, admin gates and honest experiments."""
from copy import deepcopy
from datetime import UTC, date, datetime, timedelta
import base64
from io import BytesIO
import json

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.api.v1.endpoints import analysis_quality as api
from src.api.v1.endpoints.auth import require_user
from src.core.config import Settings
from src.services.analysis_quality import service
from src.services.analysis_quality.evidence import context_for_analysis, create_source, safe_url, search_web
from src.services.analysis_quality.schemas import CandidateInput, Feedback, HypothesisInput, HypothesisReview, SourceInput
from src.services.analysis_quality.store import Conflict, QualityStore, digest
from src.services.llm_engine import job, prompts
from src.services.llm_engine.control import LLMControlStore, configured_models
from src.services.llm_engine.prompt_store import PromptStore
from src.services.llm_engine.provider import ModelDisabledError
from src.services.llm_engine.schemas import factor_evidence_references, resolve_factor_evidence
from test_corporate_valuation_analysis import Repository
from test_market_report_editions import EditionProvider, COVERAGE


@pytest.fixture
def setup(tmp_path, monkeypatch):
    settings = Settings(_env_file=None, greenpeak_llm_router_db_path=tmp_path / "router.db",
                        greenpeak_llm_providers=[{"provider_id": "groq", "model": "test-model", "api_key": "private-key"}])
    store = QualityStore(settings.greenpeak_llm_router_db_path)
    monkeypatch.setattr(api, "get_settings", lambda: settings)
    monkeypatch.setattr(service, "get_store", lambda: store)
    monkeypatch.setattr(prompts, "get_prompt_store", lambda: PromptStore(settings.greenpeak_llm_router_db_path))
    return store, settings


def client_for(role="admin"):
    app = FastAPI()
    app.include_router(api.router, prefix="/api/v1")
    if role:
        app.dependency_overrides[require_user] = lambda: {"id": "actor", "role": role}
    return TestClient(app)


def capture(store, day=date(2026, 11, 9)):
    class QualityRepository(Repository):
        def quality_context(self, *args):
            return {}
        def record_quality(self, *args):
            service.capture_report(*args, store=store)
    repository, provider = QualityRepository(), EditionProvider()
    evidence = {"report_kind": "weekly", "horizontal_evidence": {"observed_indicators": [
        {"indicator_id": "test_only", "date": day.isoformat(), "value": 1, "unit": "fixture"}]}}
    value, _ = job._analyze(repository, provider, "market", "sp500", day, evidence, COVERAGE, day, True)
    return store.get("report", value.revision_id), repository


def source(at, **overrides):
    return SourceInput(**{"title": "Synthetic research document", "publisher": "Fixture",
        "source_url": "https://www.barrons.com/articles/fixture", "published_at": at - timedelta(days=1),
        "expires_at": at + timedelta(days=10), "horizon": "medium", "kind": "opinion",
        "topics": "earnings", "content": "Synthetic paragraph for an offline test of a dated investment opinion. " * 25,
        **overrides})


def approve(store, item):
    return store.save("source", {**item, "approved": True}, "admin", item_id=item["id"], expected_revision=item["revision"])


def test_production_capture_is_immutable_and_does_not_duplicate_market_reports(setup):
    store, _ = setup
    case, repository = capture(store)
    assert case["request"]["evidence"]["horizontal_evidence"]["observed_indicators"][0]["value"] == 1
    assert case["report"]["analysis_version"] == "0.7.0"
    again = service.capture_report(case["report"], store=store)
    assert again["request"] == case["request"] and again["revision"] == 1
    assert len(repository.documents) == 1
    assert len(store.list("report")) == 1


def test_quality_storage_failure_does_not_discard_validated_report(setup, monkeypatch):
    store, _ = setup
    monkeypatch.setattr(service, "get_store", lambda: (_ for _ in ()).throw(OSError("private path")))
    service.capture_safely({}, {}, "prompt", None)


@pytest.mark.parametrize("role,expected", [(None, 401), ("user", 403), ("staff", 403), ("admin", 200)])
def test_admin_only_overview_and_no_cache(setup, role, expected):
    response = client_for(role).get("/api/v1/admin/analysis-quality")
    assert response.status_code == expected
    if expected == 200:
        assert response.headers["cache-control"] == "no-store"
        assert "private-key" not in response.text
        assert response.json()["reports"] == []


def test_stale_edits_conflict_and_audit_survives_reopen(setup):
    store, settings = setup
    case, _ = capture(store)
    feedback = Feedback(accuracy=3, evidence=4, clarity=4, uncertainty=5, usefulness=4,
                        correction="Reviewed writing improvement without a market fact", approved_example=True, expected_revision=0)
    service.save_feedback(store, case["id"], feedback, "admin")
    with pytest.raises(Conflict):
        service.save_feedback(store, case["id"], feedback, "admin")
    reopened = QualityStore(settings.greenpeak_llm_router_db_path)
    assert reopened.get("feedback", case["id"])["accuracy"] == 3
    with reopened.connect() as db:
        assert db.execute("SELECT COUNT(*) FROM audit WHERE kind='feedback'").fetchone()[0] == 1


def test_sources_require_approval_respect_dates_horizon_and_context_bound(setup):
    store, _ = setup
    at = datetime.now(UTC) + timedelta(seconds=1)
    item = create_source(store, source(at), "admin")
    assert context_for_analysis(store, "weekly", at)["research_sources"] == []
    approve(store, item)
    selected = context_for_analysis(store, "weekly", at, "earnings")["research_sources"]
    assert 1 <= len(selected) <= 2 and selected[0]["kind"] == "opinion"
    assert context_for_analysis(store, "daily", at)["research_sources"] == []
    assert context_for_analysis(store, "session", at)["research_sources"] == []
    assert context_for_analysis(store, "weekly", at + timedelta(days=20))["research_sources"] == []
    assert context_for_analysis(store, "weekly", at - timedelta(days=3))["research_sources"] == []


def test_pulse_sources_must_be_same_tehran_day_and_research_refs_resolve(setup):
    store, _ = setup
    at = datetime.now(UTC) + timedelta(seconds=2)
    approve(store, create_source(store, source(at, horizon="pulse", published_at=at - timedelta(seconds=5)), "admin"))
    selected = context_for_analysis(store, "session", at)["research_sources"]
    assert selected
    evidence = {"horizontal_evidence": {"research_sources": selected}, "hypothesis_memory": [{"thesis": "old claim"}]}
    reference = "/horizontal_evidence/research_sources/0"
    assert reference in factor_evidence_references(evidence)
    assert resolve_factor_evidence(evidence, reference) == selected[0]
    assert resolve_factor_evidence(evidence, "/hypothesis_memory/0") is None


@pytest.mark.parametrize("url", ["http://www.bls.gov/feed", "https://localhost/a", "https://127.0.0.1/a",
    "https://www.bls.gov.evil.test/a", "https://user:pass@www.bls.gov/a", "https://www.bls.gov:8000/a", "file:///etc/passwd"])
def test_online_retrieval_rejects_unapproved_targets(url):
    with pytest.raises(ValueError):
        safe_url(url)


def test_web_search_reports_unavailable_sources_without_inventing_results(monkeypatch):
    from src.services.analysis_quality import evidence
    monkeypatch.setattr(evidence, "fetch_bytes", lambda _: (_ for _ in ()).throw(httpx.ConnectError("private")))
    result = search_web("inflation")
    assert result["items"] == []
    assert all(item["status"] == "unavailable" for item in result["sources"])


def test_holdout_feedback_never_becomes_a_retrieved_writing_example(setup):
    store, _ = setup
    case, _ = capture(store)
    store.save("report", {**case, "split": "holdout"}, "admin", item_id=case["id"], expected_revision=1)
    service.save_feedback(store, case["id"], Feedback(accuracy=5, evidence=5, clarity=5, uncertainty=5, usefulness=5,
        correction="Never expose this held-out correction to production or optimization", approved_example=True, expected_revision=0), "admin")
    assert context_for_analysis(store, "weekly", datetime.now(UTC) + timedelta(seconds=1))["reviewed_examples"] == []


def test_hypothesis_requires_real_reference_and_dated_outcome_review(setup):
    store, _ = setup
    case, _ = capture(store)
    assessed = datetime.fromisoformat(case["report"]["analysis_generated_at"])
    values = {"report_id": case["id"], "title": "Synthetic thesis", "thesis": "A testable synthetic thesis, not real market data",
              "horizon": "short", "evidence_refs": ["/horizontal_evidence/observed_indicators/0"],
              "invalidation": "Synthetic counterevidence", "due_at": assessed + timedelta(days=7)}
    item = service.create_hypothesis(store, HypothesisInput(**values), "admin")
    with pytest.raises(ValueError):
        service.create_hypothesis(store, HypothesisInput(**{**values, "evidence_refs": ["/previous_market_factors/0"]}), "admin")
    review = {"status": "realized", "note": "Synthetic outcome review", "evidence_url": "https://www.bls.gov/test",
              "evidence_at": assessed + timedelta(days=1), "expected_revision": 1}
    with pytest.raises(ValueError):
        service.review_hypothesis(store, item["id"], HypothesisReview(**review), "admin", assessed + timedelta(days=1))
    reviewed = service.review_hypothesis(store, item["id"], HypothesisReview(**{**review, "status": "weakened"}), "admin", assessed + timedelta(days=1))
    assert reviewed["status"] == "weakened" and len(reviewed["reviews"]) == 1


def test_evaluation_uses_frozen_evidence_and_never_publishes_or_delivers(setup, monkeypatch):
    store, settings = setup
    case, repository = capture(store)
    case = store.save("report", {**case, "split": "development"}, "admin", item_id=case["id"], expected_revision=1)
    candidate = service.create_candidate(store, CandidateInput(title="A clearer report", amendment="Write concise explanations and preserve all material counterevidence."), "admin")
    recorded = []
    class ReplayProvider(EditionProvider):
        model_id = "different-replay-model"
        def generate_json(self, prompt, request):
            recorded.append(deepcopy(request))
            return super().generate_json(prompt, request)
    run = store.save("evaluation", {"status": "queued", "case_ids": [case["id"]], "candidate_id": candidate["id"], "results": []}, "admin")
    monkeypatch.setattr(service, "analysis_context", lambda *args: pytest.fail("Never retrieve current context in a replay"))
    service.run_evaluation(store, run["id"], settings, ReplayProvider())
    result = store.get("evaluation", run["id"])
    assert result["status"] == "completed"
    assert recorded[0] == recorded[1] == case["request"]
    assert all(value["status"] == "valid" for value in result["results"][0]["outputs"].values())
    assert all(value["report"]["provenance"]["model"] == "different-replay-model"
               for value in result["results"][0]["outputs"].values())
    assert len(repository.documents) == 1 and len(store.list("report")) == 1
    assert not store.claim("evaluation", run["id"])


def test_disabled_model_is_never_reenabled_or_called(setup, monkeypatch):
    _, settings = setup
    control = LLMControlStore(settings.greenpeak_llm_router_db_path)
    models = configured_models(settings)
    control.save(models, [{"id": models[0]["id"], "enabled": False}], 0, "admin")
    monkeypatch.setattr(httpx, "post", lambda *args, **kwargs: pytest.fail("Disabled model called"))
    with pytest.raises(ModelDisabledError):
        service.selected_provider(settings, models[0]["id"])
    assert not control.overview(models)["models"][0]["enabled"]


def test_prompt_promotion_requires_passing_reviewed_holdout_and_current_baseline(setup):
    store, _ = setup
    proposal = service.create_candidate(store, CandidateInput(title="Concise analysis", amendment="Always explain dated counterevidence without repeating the same observation."), "admin")
    with pytest.raises(ValueError):
        service.promote_candidate(store, proposal["id"], 0, "admin")
    outputs = {key: {"status": "valid"} for key in ("baseline", "candidate")}
    store.save("evaluation", {"status": "completed", "candidate_id": proposal["id"], "results": [
        {"case_id": str(i), "split": "holdout" if i == 2 else "development", "outputs": outputs,
         "review": {"decision": "candidate"}} for i in range(3)]}, "admin")
    result = service.promote_candidate(store, proposal["id"], 0, "admin")
    assert result["status"] == "promoted"
    assert proposal["amendment"] in prompts.get_prompt_store().current()["market"]["content"]
    with pytest.raises(Conflict):
        service.promote_candidate(store, proposal["id"], 1, "admin")


def test_documents_text_and_pdf_paths_and_errors(setup):
    client = client_for()
    route = "/api/v1/admin/analysis-quality/documents/extract"
    text = ("Synthetic licensed research text for an offline extraction test. " * 3).encode()
    result = client.post(route, json={"filename": "research.txt", "data_base64": base64.b64encode(text).decode()})
    assert result.status_code == 200 and "Synthetic" in result.json()["content"]
    assert client.post(route, json={"filename": "x.pdf", "data_base64": "!bad!"}).status_code == 400
    assert client.post(route, json={"filename": "x.exe", "data_base64": base64.b64encode(text).decode()}).status_code == 400
    from pypdf import PdfWriter
    writer = PdfWriter(); writer.add_blank_page(100, 100); data = BytesIO(); writer.write(data)
    assert client.post(route, json={"filename": "empty.pdf", "data_base64": base64.b64encode(data.getvalue()).decode()}).status_code == 400


def test_queue_claim_cancel_and_resume_do_not_duplicate_paid_work(setup):
    store, _ = setup
    queued = store.enqueue("evaluation", {"case_ids": []}, "admin")
    with pytest.raises(ValueError):
        store.enqueue("critique", {"report_id": "test"}, "admin")
    assert store.claim("evaluation", queued["id"])
    assert not store.claim("evaluation", queued["id"])
    running = store.get("evaluation", queued["id"])
    store.save("evaluation", {**running, "status": "cancelled"}, "admin", item_id=queued["id"], expected_revision=running["revision"])
    assert store.finish("evaluation", queued["id"], {"status": "completed"})["status"] == "cancelled"
    assert store.enqueue("critique", {"report_id": "test"}, "admin")["status"] == "queued"


def test_source_api_round_trip_revision_and_no_automatic_approval(setup):
    store, _ = setup
    client = client_for()
    body = source(datetime.now(UTC)).model_dump(mode="json")
    response = client.post("/api/v1/admin/analysis-quality/sources", json=body)
    assert response.status_code == 200
    item = response.json()
    assert not item["approved"]
    path = f"/api/v1/admin/analysis-quality/sources/{item['id']}/approval"
    assert client.put(path, json={"approved": True, "expected_revision": 1}).status_code == 200
    assert client.put(path, json={"approved": False, "expected_revision": 1}).status_code == 409
    assert client_for("staff").put(path, json={"approved": False, "expected_revision": 2}).status_code == 403
    with store.connect() as db:
        assert db.execute("SELECT actor FROM audit WHERE kind='source' ORDER BY sequence LIMIT 1").fetchone()[0] == "actor"


def test_search_uses_dated_official_results_and_excludes_future_items(monkeypatch):
    from src.services.analysis_quality import evidence
    xml = b'''<rss><channel><item><title>Inflation fixture</title><description>A synthetic inflation release</description>
    <link>https://www.bls.gov/test</link><pubDate>Mon, 16 Nov 2026 13:00:00 GMT</pubDate></item>
    <item><title>Future inflation</title><link>https://www.bls.gov/future</link><pubDate>Tue, 17 Nov 2026 13:00:00 GMT</pubDate></item></channel></rss>'''
    monkeypatch.setattr(evidence, "fetch_bytes", lambda _: xml)
    result = evidence.search_web("inflation", datetime(2026, 11, 16, 14, tzinfo=UTC))
    assert result["items"] and all(item["title"] == "Inflation fixture" for item in result["items"])


def test_suggestion_sees_development_feedback_only(setup):
    store, settings = setup
    for index, split in enumerate(("development", "holdout")):
        case, _ = capture(store, date(2026, 11, 9 + index))
        store.save("report", {**case, "split": split}, "admin", item_id=case["id"], expected_revision=1)
        service.save_feedback(store, case["id"], Feedback(accuracy=3, evidence=3, clarity=3, uncertainty=3, usefulness=3,
            correction="HOLDOUT_SECRET" if split == "holdout" else "DEVELOPMENT_FEEDBACK", expected_revision=0), "admin")
    class SuggestionProvider:
        model_id = "fixture"
        provider_id = "fixture"
        def generate_json(self, prompt, request):
            text = json.dumps(request)
            assert "HOLDOUT_SECRET" not in text and "DEVELOPMENT_FEEDBACK" in text
            return {"title": "Shorter writing", "amendment": "Explain the causal link only when the supplied evidence supports it."}
    run = store.enqueue("suggestion", {}, "admin")
    service.run_suggestion(store, run["id"], settings, SuggestionProvider())
    assert store.get("suggestion", run["id"])["status"] == "completed"
    assert store.list("candidate")[0]["status"] == "draft"


def test_critic_is_advisory_and_does_not_modify_original_report(setup):
    store, settings = setup
    case, _ = capture(store)
    before = deepcopy(case)
    class CriticProvider:
        provider_id = "fixture"
        model_id = "fixture"
        def generate_json(self, prompt, request):
            assert request["evidence"] == case["request"]["evidence"]
            return {"verdict": "review", "issues": ["Synthetic evidence issue"], "suggestions": ["Check the cited original source"]}
    run = store.enqueue("critique", {"report_id": case["id"]}, "admin")
    service.run_critic(store, run["id"], settings, CriticProvider())
    assert store.get("critique", run["id"])["result"]["verdict"] == "review"
    assert store.get("report", case["id"]) == before


def test_prompt_cannot_promote_after_active_prompt_changes(setup):
    store, settings = setup
    candidate = service.create_candidate(store, CandidateInput(title="Frozen baseline", amendment="Use dated evidence and explicitly name the counterevidence."), "admin")
    prompts.get_prompt_store().save("market", "Another administrator changed this prompt.", "fixture", 0, "other")
    with pytest.raises(Conflict):
        service.promote_candidate(store, candidate["id"], 1, "admin")


def test_empty_multi_page_pdf_does_not_count_page_markers_as_evidence(setup):
    from pypdf import PdfWriter
    writer = PdfWriter()
    for _ in range(20):
        writer.add_blank_page(100, 100)
    data = BytesIO(); writer.write(data)
    response = client_for().post("/api/v1/admin/analysis-quality/documents/extract", json={
        "filename": "scanned.pdf", "data_base64": base64.b64encode(data.getvalue()).decode()})
    assert response.status_code == 400


def test_all_disabled_blocks_quality_jobs_before_enqueue(setup, monkeypatch):
    store, settings = setup
    models = configured_models(settings)
    LLMControlStore(settings.greenpeak_llm_router_db_path).save(models, [{"id": models[0]["id"], "enabled": False}], 0, "admin")
    monkeypatch.setattr(httpx, "post", lambda *args, **kwargs: pytest.fail("Disabled model called"))
    response = client_for().post("/api/v1/admin/analysis-quality/suggestions")
    assert response.status_code == 409
    assert store.list("suggestion") == []


def test_cancel_during_model_call_stops_repair_and_next_variant(setup):
    store, settings = setup
    case, _ = capture(store)
    candidate = service.create_candidate(store, CandidateInput(title="Cancellation test", amendment="Use concise dated evidence and preserve the relevant qualifications."), "admin")
    run = store.enqueue("evaluation", {"case_ids": [case["id"]], "candidate_id": candidate["id"], "results": []}, "admin")
    calls = []
    class CancellingProvider(EditionProvider):
        def generate_json(self, prompt, request):
            calls.append(1)
            current = store.get("evaluation", run["id"])
            store.save("evaluation", {**current, "status": "cancelled"}, "admin", item_id=run["id"], expected_revision=current["revision"])
            return {}  # Would normally provoke a paid validation-repair call.
    service.run_evaluation(store, run["id"], settings, CancellingProvider())
    assert calls == [1]
    assert store.get("evaluation", run["id"])["status"] == "cancelled"
    assert store.get("evaluation", run["id"])["results"] == []


def test_full_app_health_and_quality_api_round_trip(setup, monkeypatch):
    import src.main as main
    store, _ = setup
    for name in dir(main):
        if name.startswith("create_") and name.endswith("_scheduler"):
            monkeypatch.setattr(main, name, lambda: None)
    case, _ = capture(store)
    app = main.create_app()
    app.dependency_overrides[require_user] = lambda: {"id": "admin", "role": "admin"}
    with TestClient(app) as client:
        assert client.get("/health").status_code == 200
        assert client.get("/api/v1/admin/analysis-quality").status_code == 200
        response = client.get(f"/api/v1/admin/analysis-quality/reports/{case['id']}")
        assert response.status_code == 200 and response.json()["evidence"] == case["request"]["evidence"]
        saved = client.put(f"/api/v1/admin/analysis-quality/reports/{case['id']}/feedback", json={
            "accuracy": 4, "evidence": 4, "clarity": 4, "uncertainty": 4, "usefulness": 4, "expected_revision": 0})
        assert saved.status_code == 200
        assert client.get("/api/v1/admin/analysis-quality").json()["metrics"]["accuracy"] == 4


def test_retained_research_cannot_bypass_expiry_or_revocation(setup):
    from src.services.analysis_quality.evidence import filter_retained_sources
    store, _ = setup
    at = datetime.now(UTC) + timedelta(seconds=1)
    item = approve(store, create_source(store, source(at), "admin"))
    excerpt = context_for_analysis(store, "weekly", at)["research_sources"][0]
    retained = {"research": excerpt, "news": {"title": "Existing dated news"}}
    assert filter_retained_sources(store, retained, at) == retained
    assert filter_retained_sources(store, retained, at + timedelta(days=20)) == {"news": retained["news"]}
    store.save("source", {**item, "approved": False}, "admin", item_id=item["id"], expected_revision=item["revision"])
    assert filter_retained_sources(store, retained, at) == {"news": retained["news"]}
