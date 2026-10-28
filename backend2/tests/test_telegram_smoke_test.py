from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

from src.core.config import Settings
from src.services.llm_engine import telegram_smoke_test as smoke
from src.utils.telegram import TelegramDeliveryResult


WHEN = datetime(2026, 10, 28, 21, tzinfo=timezone(timedelta(hours=3, minutes=30)))


@pytest.fixture
def probe(tmp_path, monkeypatch):
    settings = Settings(_env_file=None, greenpeak_llm_providers=[],
                        greenpeak_llm_api_key="test-key", telegram_bot_token="bot-test",
                        telegram_chat_id="test-chat", telegram_message_thread_id=42,
                        greenpeak_llm_router_db_path=tmp_path / "router.db")
    calls = []

    def generate(prompt, evidence):
        calls.append("llm")
        return {"message_fa": "Test <ok>"}

    provider = SimpleNamespace(provider_id="groq", model_id="test", generate_json=generate)
    monkeypatch.setattr(smoke, "create_llm_provider", lambda _: provider)

    def send(text, topic, **kwargs):
        assert topic == 42 and kwargs["require_topic"]
        calls.append(text)
        return TelegramDeliveryResult("sent", message_id=123)

    monkeypatch.setattr(smoke, "send_telegram_message", send)
    return settings, calls, provider


def test_one_llm_request_one_message_and_no_repeated_delivery(probe):
    settings, calls, _ = probe
    result = smoke.run_probe(WHEN, settings=settings, now=WHEN)
    assert result["status"] == "sent" and result["provider"] == "groq"
    assert len(calls) == 2 and "Test &lt;ok&gt;" in calls[1]
    assert "21:00" in calls[1]
    assert smoke.run_probe(WHEN, settings=settings, now=WHEN)["status"] == "already_attempted"
    assert len(calls) == 2


@pytest.mark.parametrize("delta", [-1, 301])
def test_does_not_send_early_or_after_execution_window(probe, delta):
    settings, calls, _ = probe
    result = smoke.run_probe(WHEN, settings=settings, now=WHEN + timedelta(seconds=delta))
    assert result["status"] == "outside_execution_window" and calls == []


def test_dry_run_has_no_network_or_persistence(probe):
    settings, calls, _ = probe
    assert smoke.run_probe(WHEN, settings=settings, dry_run=True)["status"] == "dry_run"
    assert calls == []
    assert not settings.greenpeak_llm_router_db_path.with_name("llm_telegram_smoke.db").exists()


def test_failed_llm_still_reports_failure_to_telegram_without_secrets(probe):
    settings, calls, provider = probe

    def fail(*_):
        raise ValueError("secret-key-do-not-print")

    provider.generate_json = fail
    result = smoke.run_probe(WHEN, settings=settings, now=WHEN)
    assert result["llm_error"] == "ValueError" and result["status"] == "sent"
    assert len(calls) == 1
    assert "secret-key" not in str(result) + calls[0]


def test_uncertain_telegram_delivery_is_not_retried(probe, monkeypatch):
    settings, calls, _ = probe
    monkeypatch.setattr(smoke, "send_telegram_message", lambda *_a, **_k:
                        TelegramDeliveryResult("uncertain", "telegram_delivery_outcome_unknown"))
    assert smoke.run_probe(WHEN, settings=settings, now=WHEN)["status"] == "uncertain"
    assert smoke.run_probe(WHEN, settings=settings, now=WHEN)["status"] == "already_attempted"
    assert calls == ["llm"]
