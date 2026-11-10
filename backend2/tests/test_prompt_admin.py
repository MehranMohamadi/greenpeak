"""Administrator prompt editing and offline generation integration."""

import os
import sqlite3
from datetime import date
from types import SimpleNamespace
from uuid import uuid4

os.environ["DEBUG"] = "false"

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.api.v1.endpoints import llm_admin, news
from src.api.v1.endpoints.auth import require_user
from src.services.llm_engine import prompts, job
from src.services.llm_engine.prompt_store import PromptStore


@pytest.fixture
def store(tmp_path, monkeypatch):
    value = PromptStore(tmp_path / "router.db")
    monkeypatch.setattr(prompts, "get_prompt_store", lambda: value)
    monkeypatch.setattr(llm_admin, "get_prompt_store", lambda: value)
    return value


def client_for(role="admin"):
    app = FastAPI()
    app.include_router(llm_admin.router, prefix="/api/v1")
    if role:
        app.dependency_overrides[require_user] = lambda: {"id": "test-actor", "role": role}
    return TestClient(app)


def document(response, prompt_id):
    return next(item for item in response.json()["prompts"] if item["id"] == prompt_id)


@pytest.mark.parametrize("role,status", [(None, 401), ("user", 403), ("staff", 403)])
def test_prompt_reads_and_writes_require_verified_admin(store, role, status):
    client = client_for(role)
    assert client.get("/api/v1/admin/llm/prompts").status_code == status
    assert client.put("/api/v1/admin/llm/prompts/market", json={"content": "test", "expected_revision": 0}).status_code == status
    assert store.current() == {}


def test_catalog_preview_matches_exact_active_system_prompt(store):
    response = client_for().get("/api/v1/admin/llm/prompts")
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert {item["id"] for item in response.json()["prompts"]} == set(prompts.PROMPT_DEFINITIONS)
    assert "updated_by" not in response.text and "api_key" not in response.text
    for level in ("indicator", "domain", "market"):
        entry = document(response, level)
        active = prompts.load_prompt(level)
        assert entry["effective_content"] == active.content
        assert entry["effective_hash"] == active.hash
    for level in ("news", "chat_planner", "chat_answer"):
        assert document(response, level)["effective_content"] == prompts.load_text_prompt(level).content


def test_shared_prompt_edits_are_versioned_apply_to_every_analysis_and_preserve_files(store):
    client = client_for()
    source = prompts.PROMPT_ROOT / "core_system.md"
    before = source.read_bytes()
    old_hashes = {level: prompts.load_prompt(level).hash for level in ("indicator", "domain", "market")}
    response = client.put("/api/v1/admin/llm/prompts/core_system", json={"content": "Updated shared analysis instruction.", "expected_revision": 0})
    assert response.status_code == 200
    assert document(response, "core_system")["revision"] == 1
    assert document(response, "core_system")["updated_at"]
    for level in old_hashes:
        active = prompts.load_prompt(level)
        assert "Updated shared analysis instruction." in active.content
        assert active.hash != old_hashes[level]
        assert "-admin.1" in active.version
        assert document(response, level)["effective_content"] == active.content
    assert source.read_bytes() == before
    assert PromptStore(store.path.with_name("router.db")).current()["core_system"]["updated_by"] == "test-actor"


@pytest.mark.parametrize("enabled", [True, False])
def test_catalog_distinguishes_default_configured_and_on_demand_schedules(store, monkeypatch, enabled):
    from src.core.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(settings, "greenpeak_daily_analysis_enabled", enabled)
    monkeypatch.setattr(settings, "greenpeak_daily_analysis_hour", 6)
    monkeypatch.setattr(settings, "greenpeak_daily_analysis_minute", 30)
    monkeypatch.setattr(settings, "greenpeak_daily_analysis_timezone", "UTC")
    monkeypatch.setattr(settings, "greenpeak_market_evening_analysis_enabled", True)
    monkeypatch.setattr(settings, "greenpeak_market_evening_analysis_hour", 21)
    monkeypatch.setattr(settings, "greenpeak_market_evening_analysis_minute", 30)
    monkeypatch.setattr(settings, "greenpeak_market_evening_analysis_timezone", "Asia/Tehran")
    client = client_for()
    response = client.get("/api/v1/admin/llm/prompts")
    assert response.status_code == 200
    for prompt_id in ("core_system", "indicator", "domain", "market"):
        schedule = document(response, prompt_id)["update_schedule"]
        assert "۱۶:۰۰" in schedule["default_summary_fa"]
        assert "تهران" in schedule["default_summary_fa"]
        if prompt_id in ("core_system", "market"):
            assert "۲۱:۳۰" in schedule["default_summary_fa"]
            assert "روزانه دو نوبت" in schedule["default_summary_fa"]
        if enabled:
            assert "۰۶:۳۰" in schedule["configured_summary_fa"]
            assert "UTC" in schedule["configured_summary_fa"]
        else:
            assert "غیرفعال" in schedule["configured_summary_fa"]
    assert "اجرای مستقل ندارد" in document(response, "core_system")["update_schedule"]["details_fa"]
    for prompt_id in ("news", "chat_planner", "chat_answer"):
        schedule = document(response, prompt_id)["update_schedule"]
        assert "بدون ساعت ثابت" in schedule["default_summary_fa"]
        assert schedule["default_summary_fa"] == schedule["configured_summary_fa"]
    saved = client.put("/api/v1/admin/llm/prompts/market", json={"content": "Edited", "expected_revision": 0})
    assert saved.status_code == 200
    assert document(saved, "market")["update_schedule"] == document(response, "market")["update_schedule"]


def test_conflict_preserves_first_edit_and_default_reset_creates_a_new_revision(store):
    client = client_for()
    url = "/api/v1/admin/llm/prompts/market"
    response = client.put(url, json={"content": "First edit", "expected_revision": 0})
    assert response.status_code == 200
    conflict = client.put(url, json={"content": "Stale overwrite", "expected_revision": 0})
    assert conflict.status_code == 409
    assert store.current()["market"]["content"] == "First edit"
    default = document(response, "market")["default_content"]
    response = client.put(url, json={"content": default, "expected_revision": 1})
    assert response.status_code == 200
    assert document(response, "market")["revision"] == 2
    assert document(response, "market")["customized"] is False
    with store.connect() as db:
        assert db.execute("SELECT COUNT(*) FROM prompt_revisions WHERE prompt_id='market'").fetchone()[0] == 2


@pytest.mark.parametrize("content", ["", " \n\t", "contains\x00null", "x" * 100001], ids=["empty", "whitespace", "null", "too-long"])
def test_invalid_prompt_content_is_rejected(store, content):
    result = client_for().put("/api/v1/admin/llm/prompts/market", json={"content": content, "expected_revision": 0})
    assert result.status_code == 422
    assert store.current() == {}


def test_unknown_prompt_and_storage_failures_are_sanitized(store, monkeypatch):
    client = client_for()
    body = {"content": "test", "expected_revision": 0}
    assert client.put("/api/v1/admin/llm/prompts/not-configured", json=body).status_code == 404
    def fail():
        raise sqlite3.OperationalError("private-path-and-credential")
    monkeypatch.setattr(prompts, "get_prompt_store", fail)
    monkeypatch.setattr(llm_admin, "get_prompt_store", fail)
    for result in [client.get("/api/v1/admin/llm/prompts"), client.put("/api/v1/admin/llm/prompts/market", json=body)]:
        assert result.status_code == 503
        assert "private" not in result.text


def test_edited_prompt_invalidates_narrative_cache_and_reaches_provider(store):
    from test_llm_engine import FakeProvider, MemoryRepository
    class Provider(FakeProvider):
        calls = 0
        seen = []
        def generate_json(self, prompt, evidence):
            self.seen.append(prompt)
            return super().generate_json(prompt, evidence)
    provider = Provider()
    repository = MemoryRepository()
    coverage = {"status": "full", "ratio": 1, "configured_count": 1, "available_count": 1, "missing_inputs": []}
    arguments = (repository, provider, "indicator", "federal_funds_rate", date(2026, 11, 3), {"versions": {}}, coverage, None, False)
    old, _ = job._analyze(*arguments)
    default = prompts.default_prompt("indicator")
    store.save("indicator", default.content + "\nCustom administrator instruction.", default.version, 0, "actor")
    current, status = job._analyze(*arguments)
    assert status == "generated" and provider.calls == 2
    assert "Custom administrator instruction." in provider.seen[-1]
    assert current.provenance.prompt_hash != old.provenance.prompt_hash
    assert "-admin.1" in current.provenance.prompt_version


def test_news_generation_uses_saved_prompt_and_records_its_version(store, monkeypatch):
    from src.services.news import article_analysis
    from test_news_article_analysis import FakeProvider, FakeResponse
    default = prompts.default_prompt("news")
    store.save("news", default.content + "\nCustom news instruction.", default.version, 0, "actor")
    monkeypatch.setattr(article_analysis.httpx, "get", lambda *a, **kw: FakeResponse())
    class Provider(FakeProvider):
        def generate_json(self, prompt, evidence):
            assert "Custom news instruction." in prompt
            return super().generate_json(prompt, evidence)
    result = article_analysis.analyze_news_document({"item_id": "fixture", "title": "Fixture headline", "url": "https://example.com/article"}, Provider())
    assert result["prompt_version"].endswith("-admin.1")
    assert result["prompt_hash"] == prompts.load_text_prompt("news").hash


def test_chat_uses_both_saved_templates_with_existing_evidence_validation(store):
    from src.services.chat.engine import generate_reply
    from src.services.chat.schemas import MessageRequest
    from test_chat import Evidence, Provider
    for prompt_id in ("chat_planner", "chat_answer"):
        default = prompts.default_prompt(prompt_id)
        store.save(prompt_id, default.content + f"\nCustom {prompt_id} instruction.", default.version, 0, "actor")
    class Capture(Provider):
        prompts_seen = []
        def generate_json(self, prompt, evidence):
            self.prompts_seen.append(prompt)
            return super().generate_json(prompt, evidence)
    provider = Capture()
    result = generate_reply(provider, Evidence(), "alice", {"scope": "site"}, MessageRequest(content="test", request_id=uuid4()), [])
    assert len(provider.prompts_seen) == 2
    assert "Custom chat_planner instruction." in provider.prompts_seen[0]
    assert "Custom chat_answer instruction." in provider.prompts_seen[1]
    assert result["sources"]


def test_news_prompt_change_invalidates_only_mismatched_cached_analysis(store, monkeypatch):
    default = prompts.default_prompt("news")
    store.save("news", default.content + "\nChanged", default.version, 0, "actor")
    active = prompts.load_text_prompt("news")
    cached = {"item_id": "fixture", "prompt_hash": default.hash}
    saved = []
    class Repository:
        def article_analysis(self, *args): return cached
        def item_by_id(self, *args): return {"item_id": "fixture"}
        def save_article_analysis(self, result): saved.append(result)
    monkeypatch.setattr(news, "_repository", lambda: (SimpleNamespace(close=lambda: None), Repository()))
    monkeypatch.setattr(news, "llm_is_configured", lambda _: True)
    monkeypatch.setattr(news, "create_llm_provider", lambda *a, **kw: object())
    def analyze(document, provider, *, prompt):
        assert prompt.content == active.content
        return {"item_id": "fixture", "prompt_hash": prompt.hash}
    monkeypatch.setattr(news, "analyze_news_document", analyze)
    assert news.news_item_analysis("fixture")["data"]["prompt_hash"] == active.hash
    assert len(saved) == 1
    cached["prompt_hash"] = active.hash
    assert news.news_item_analysis("fixture")["data"] == cached
    assert len(saved) == 1


def test_legacy_news_cache_remains_usable_with_unedited_default_prompt(store, monkeypatch):
    cached = {"item_id": "fixture", "title_fa": "Cached translation"}
    repository = SimpleNamespace(article_analysis=lambda *args: cached)
    monkeypatch.setattr(news, "_repository", lambda: (SimpleNamespace(close=lambda: None), repository))
    def unexpected(*args, **kwargs):
        pytest.fail("Reading a compatible cached analysis must not call a model")
    monkeypatch.setattr(news, "create_llm_provider", unexpected)
    assert news.news_item_analysis("fixture")["data"] == cached


def test_full_application_prompt_api_and_health_without_external_services(store, monkeypatch):
    import src.main as main
    for name in ("create_daily_analysis_scheduler", "create_news_scheduler", "create_official_sentiment_scheduler", "create_work_task_notification_scheduler"):
        monkeypatch.setattr(main, name, lambda: None)
    app = main.create_app()
    app.dependency_overrides[require_user] = lambda: {"id": "actor", "role": "admin"}
    with TestClient(app) as client:
        assert client.get("/health").status_code == 200
        assert client.get("/api/v1/admin/llm/prompts").status_code == 200
        assert client.put("/api/v1/admin/llm/prompts/market", json={"content": "Updated test prompt", "expected_revision": 0}).status_code == 200
