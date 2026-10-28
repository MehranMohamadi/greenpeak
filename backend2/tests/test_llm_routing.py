import os
from datetime import UTC, datetime
from email.utils import format_datetime

os.environ["DEBUG"] = "false"

import httpx
import pytest

from src.core.config import LLMEndpointSettings, Settings
from src.services.llm_engine import routing


def configuration(tmp_path):
    return Settings(_env_file=None, greenpeak_llm_providers=[
        LLMEndpointSettings(provider_id="gemini", model="gemini-test", api_key="gemini-key"),
        LLMEndpointSettings(provider_id="mistral", model="mistral-test", api_key="mistral-key"),
    ], greenpeak_llm_router_db_path=tmp_path / "router.db")


def reply(url, status=200, body=None, headers=None):
    return httpx.Response(status, json=body if body is not None else {
        "choices": [{"message": {"content": '{"answer":"ok"}'}}]
    }, headers=headers, request=httpx.Request("POST", url))


def test_quota_fails_over_and_cooldown_survives_new_router(tmp_path, monkeypatch):
    settings = configuration(tmp_path)
    clock = [1000]
    monkeypatch.setattr(routing.time, "time", lambda: clock[0])
    calls = []

    def post(url, **kwargs):
        calls.append(url)
        if "googleapis" in url:
            assert kwargs["headers"]["Authorization"] == "Bearer gemini-key"
            return reply(url, 429, {"error": {"code": "RESOURCE_EXHAUSTED"}}, {"retry-after": "120"})
        assert kwargs["headers"]["Authorization"] == "Bearer mistral-key"
        return reply(url)

    monkeypatch.setattr(httpx, "post", post)
    provider = routing.create_llm_provider(settings)
    assert provider.generate_json("system", {}) == {"answer": "ok"}
    assert (provider.provider_id, provider.model_id) == ("mistral", "mistral-test")
    assert len(calls) == 2
    provider = routing.create_llm_provider(settings)
    assert provider.provider_id == "mistral"
    provider.generate_json("system", {})
    assert len(calls) == 3 and "mistral" in calls[-1]
    clock[0] += 121
    provider.generate_json("system", {})
    assert len(calls) == 5 and "googleapis" in calls[-2]
    assert b"gemini-key" not in settings.greenpeak_llm_router_db_path.read_bytes()


@pytest.mark.parametrize("status", [402, 429, 500, 502, 503, 504])
def test_retryable_errors_try_second_provider(status, tmp_path, monkeypatch):
    calls = []
    def post(url, **kwargs):
        calls.append(url)
        return reply(url, status, {"error": {}}) if len(calls) == 1 else reply(url)
    monkeypatch.setattr(httpx, "post", post)
    assert routing.create_llm_provider(configuration(tmp_path)).generate_json("system", {}) == {"answer": "ok"}
    assert len(calls) == 2


@pytest.mark.parametrize("status", [400, 401, 403, 404, 422])
def test_bad_requests_and_permissions_do_not_switch(status, tmp_path, monkeypatch):
    calls = []
    def post(url, **kwargs):
        calls.append(url)
        return reply(url, status, {"error": {}})
    monkeypatch.setattr(httpx, "post", post)
    with pytest.raises(httpx.HTTPStatusError):
        routing.create_llm_provider(configuration(tmp_path)).generate_json("system", {})
    assert len(calls) == 1


def test_all_exhausted_do_not_call_again_during_cooldown(tmp_path, monkeypatch):
    calls = []
    def post(url, **kwargs):
        calls.append(url)
        return reply(url, 429, {"error": {}}, {"retry-after": "300"})
    monkeypatch.setattr(httpx, "post", post)
    settings = configuration(tmp_path)
    for _ in range(2):
        with pytest.raises(httpx.HTTPStatusError) as error:
            routing.create_llm_provider(settings).generate_json("system", {})
        assert error.value.response.status_code == 429
    assert len(calls) == 2


def test_network_failure_switches(tmp_path, monkeypatch):
    calls = []
    def post(url, **kwargs):
        calls.append(url)
        if len(calls) == 1:
            raise httpx.ConnectError("offline")
        return reply(url)
    monkeypatch.setattr(httpx, "post", post)
    assert routing.create_llm_provider(configuration(tmp_path)).generate_json("system", {}) == {"answer": "ok"}
    assert len(calls) == 2


@pytest.mark.parametrize("body", [
    {"choices": [{"message": {"content": "invalid"}}]},
    {"choices": [{"message": {"content": None}}]},
    {"choices": [{"message": {"content": "   "}}]},
    {"choices": [{"message": {"content": "[]"}}]},
    {"choices": []},
    {},
    [],
])
def test_invalid_response_fails_over_to_cloudflare(body, tmp_path, monkeypatch):
    settings = configuration(tmp_path)
    settings.greenpeak_llm_providers[1] = LLMEndpointSettings(
        provider_id="cloudflare", model="test", api_key="cf-key",
        base_url="https://api.cloudflare.com/client/v4/accounts/test/ai/v1")
    calls = []

    def post(url, **kwargs):
        calls.append(url)
        return reply(url, body=body) if "googleapis" in url else reply(url)

    monkeypatch.setattr(httpx, "post", post)
    provider = routing.create_llm_provider(settings)
    assert provider.generate_json("system", {}) == {"answer": "ok"}
    assert provider.provider_id == "cloudflare"
    assert len(calls) == 2


def test_all_invalid_responses_fail_without_accepting_invalid_output(tmp_path, monkeypatch):
    from src.services.llm_engine.provider import InvalidLLMResponse

    calls = []

    def post(url, **kwargs):
        calls.append(url)
        return reply(url, body={"choices": [{"message": {"content": "invalid"}}]})

    monkeypatch.setattr(httpx, "post", post)
    with pytest.raises(InvalidLLMResponse):
        routing.create_llm_provider(configuration(tmp_path)).generate_json("system", {})
    assert len(calls) == 2


def test_timeout_fails_over(tmp_path, monkeypatch):
    calls = []

    def post(url, **kwargs):
        calls.append(url)
        if "googleapis" in url:
            raise httpx.ReadTimeout("timeout")
        return reply(url)

    monkeypatch.setattr(httpx, "post", post)
    assert routing.create_llm_provider(configuration(tmp_path)).generate_json("system", {}) == {"answer": "ok"}
    assert len(calls) == 2


def test_retry_hints():
    now = 1000
    date_header = format_datetime(datetime.fromtimestamp(1120, UTC), usegmt=True)
    assert routing.retry_delay(reply("https://test.invalid", headers={"retry-after": date_header}), now) == 120
    body = {"error": {"details": [{"@type": "type.googleapis.com/google.rpc.RetryInfo", "retryDelay": "45s"}]}}
    assert routing.retry_delay(reply("https://test.invalid", body=body), now) == 45
    assert routing.retry_delay(reply("https://test.invalid", headers={"retry-after": "nan"}), now) == 60
    assert routing.retry_delay(reply("https://test.invalid"), now) == 60
    assert routing.retry_delay(reply("https://test.invalid", body={"error": {"details": [{"@type": None}]}}), now) == 60


def test_explicit_403_quota_switches(tmp_path, monkeypatch):
    calls = []
    def post(url, **kwargs):
        calls.append(url)
        return reply(url, 403, {"error": {"code": "insufficient_quota"}}) if len(calls) == 1 else reply(url)
    monkeypatch.setattr(httpx, "post", post)
    assert routing.create_llm_provider(configuration(tmp_path)).generate_json("system", {}) == {"answer": "ok"}
    assert len(calls) == 2


def test_list_overrides_legacy_and_supports_third_provider(tmp_path):
    settings = configuration(tmp_path)
    settings.greenpeak_llm_api_key = "legacy-key"
    settings.greenpeak_llm_providers.append(LLMEndpointSettings(
        provider_id="third", model="third-model", api_key="third-key", base_url="https://third.invalid/v1"))
    provider = routing.create_llm_provider(settings)
    assert [p.provider_id for p in provider.providers] == ["gemini", "mistral", "third"]
    assert routing.llm_is_configured(settings)
    assert "gemini-key" not in repr(settings)
    settings.greenpeak_llm_providers = []
    assert routing.create_llm_provider(settings).api_key == "legacy-key"
    settings.greenpeak_llm_api_key = ""
    assert not routing.llm_is_configured(settings)
    assert routing.create_llm_provider(settings).provider_id == "disabled"


def test_environment_json_configuration(tmp_path, monkeypatch):
    monkeypatch.setenv("GREENPEAK_LLM_PROVIDERS", '[{"provider_id":"mistral","model":"test","api_key":"secret"}]')
    settings = Settings(_env_file=None, greenpeak_llm_router_db_path=tmp_path / "router.db")
    assert routing.create_llm_provider(settings).providers[0].base_url == routing.DIRECT_URLS["mistral"]


def test_env_example_fails_over_to_direct_cloudflare(tmp_path, monkeypatch):
    import json
    from pathlib import Path
    from dotenv import dotenv_values

    example = Path(__file__).resolve().parents[2] / ".env.example"
    entries = json.loads(dotenv_values(example)["GREENPEAK_LLM_PROVIDERS"])
    assert [item["provider_id"] for item in entries] == ["gemini", "cloudflare"]
    settings = configuration(tmp_path)
    settings.greenpeak_llm_providers = [LLMEndpointSettings.model_validate(item) for item in entries]
    calls = []

    def post(url, **kwargs):
        calls.append(url)
        if "googleapis" in url:
            return reply(url, 429, {"error": {}}, {"Retry-After": "120"})
        assert url == "https://api.cloudflare.com/client/v4/accounts/YOUR_CLOUDFLARE_ACCOUNT_ID/ai/v1/chat/completions"
        assert kwargs["headers"]["Authorization"] == "Bearer YOUR_CLOUDFLARE_API_TOKEN"
        assert kwargs["json"]["model"] == "@cf/qwen/qwen3-30b-a3b-fp8"
        assert kwargs["json"]["response_format"] == {"type": "json_object"}
        return reply(url)

    monkeypatch.setattr(httpx, "post", post)
    provider = routing.create_llm_provider(settings)
    assert provider.generate_json("Return JSON", {}) == {"answer": "ok"}
    assert provider.provider_id == "cloudflare" and len(calls) == 2
