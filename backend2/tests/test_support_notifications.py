"""Offline support API, independent delivery, privacy and restart checks."""

import json
from concurrent.futures import ThreadPoolExecutor
from html import unescape
from unittest.mock import Mock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.api.v1.endpoints import support as routes
from src.core.config import Settings
from src.services.auth import AuthStorageError
from src.services.auth_email import EmailSender
from src.services.support_notifications import SupportNotifications, telegram_parts
from src.utils.telegram import TelegramDeliveryResult

PAYLOAD = {"name": "کاربر <b>آزمایش</b>", "email": "user@example.com",
           "category": "question", "message": "پرسش آزمایشی درباره سایت & خدمات"}


@pytest.fixture
def setup(tmp_path):
    settings = Settings(_env_file=None, support_db_path=tmp_path / "support.db",
                        resend_api_key="private-email-key", auth_email_from="support@example.com",
                        telegram_bot_token="private-bot-token", telegram_chat_id="-100123",
                        telegram_support_message_thread_id=42)
    email_sender = Mock()
    telegram_sender = Mock(return_value=TelegramDeliveryResult("sent", message_id=1))
    now = [1000.0]
    worker = SupportNotifications(settings, email_sender=email_sender,
                                  telegram_sender=telegram_sender, clock=lambda: now[0])
    return worker, now


def statuses(worker):
    with worker.connect() as db:
        return {(row["channel"], row["part"]): row["status"]
                for row in db.execute("SELECT * FROM support_deliveries")}


def test_both_channels_delivered_once_after_restart(setup):
    worker, _ = setup
    identifier = worker.submit(PAYLOAD)
    restored = SupportNotifications(worker.settings, email_sender=worker.email_sender,
                                    telegram_sender=worker.telegram_sender, clock=worker.clock)
    restored.process(); worker.process()
    assert statuses(worker) == {("email", 0): "sent", ("telegram", 0): "sent"}
    assert worker.email_sender.send_support_message.call_count == 1
    assert worker.email_sender.send_support_message.call_args.kwargs == {
        **PAYLOAD, "idempotency_key": f"support-{identifier}"}
    assert worker.telegram_sender.call_count == 1
    call = worker.telegram_sender.call_args
    assert call.args[1] == 42 and call.kwargs["require_topic"] is True
    assert "&lt;b&gt;" in call.args[0] and "<b>آزمایش</b>" not in call.args[0]


def test_email_failure_does_not_block_telegram_and_reuses_retry_key(setup):
    worker, now = setup
    worker.email_sender.send_support_message.side_effect = AuthStorageError("private upstream details")
    worker.submit(PAYLOAD); worker.process()
    assert statuses(worker) == {("email", 0): "retry", ("telegram", 0): "sent"}
    original = worker.email_sender.send_support_message.call_args.kwargs["idempotency_key"]
    now[0] += 31
    worker.email_sender.send_support_message.side_effect = None
    worker.process()
    assert worker.email_sender.send_support_message.call_args.kwargs["idempotency_key"] == original
    assert worker.telegram_sender.call_count == 1
    assert statuses(worker)["email", 0] == "sent"


def test_ambiguous_telegram_is_not_resent_and_email_still_sends(setup, caplog):
    worker, now = setup
    worker.telegram_sender.side_effect = RuntimeError("private-bot-token user@example.com private body")
    worker.submit(PAYLOAD); worker.process()
    now[0] += 10000; worker.process()
    assert statuses(worker) == {("email", 0): "sent", ("telegram", 0): "uncertain"}
    assert worker.telegram_sender.call_count == 1
    assert "private-bot-token" not in caplog.text and "user@example.com" not in caplog.text


def test_missing_support_topic_never_falls_back_to_market_or_task_topic(setup):
    worker, now = setup
    worker.settings.telegram_support_message_thread_id = None
    worker.settings.telegram_message_thread_id = 123
    worker.settings.telegram_task_message_thread_id = 456
    worker.submit(PAYLOAD); worker.process()
    worker.telegram_sender.assert_not_called()
    assert statuses(worker)["telegram", 0] == "pending"
    worker.settings.telegram_support_message_thread_id = 42
    worker.process()
    assert statuses(worker)["telegram", 0] == "sent"


def test_parallel_workers_cannot_claim_same_delivery(setup):
    worker, _ = setup
    worker.submit(PAYLOAD)
    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(lambda _: worker.process(), range(4)))
    assert worker.email_sender.send_support_message.call_count == 1
    assert worker.telegram_sender.call_count == 1


def test_stale_telegram_claim_is_uncertain_and_not_retried(setup):
    worker, now = setup
    worker.settings.resend_api_key = ""
    worker.submit(PAYLOAD)
    assert worker.claim()["channel"] == "telegram"
    now[0] += 301; worker.process()
    assert statuses(worker)["telegram", 0] == "uncertain"
    worker.telegram_sender.assert_not_called()


def test_rate_limited_telegram_retries_only_failed_part(setup):
    worker, now = setup
    worker.telegram_sender.side_effect = [TelegramDeliveryResult("retry", retry_after=120),
                                         TelegramDeliveryResult("sent"), TelegramDeliveryResult("sent")]
    worker.submit({**PAYLOAD, "message": "x" * 1500}); worker.process()
    assert statuses(worker)["telegram", 0] == "retry"
    assert statuses(worker)["telegram", 1] == "sent"
    now[0] += 31; worker.process()
    assert worker.telegram_sender.call_count == 2
    now[0] += 90; worker.process()
    assert worker.telegram_sender.call_count == 3
    assert all(value == "sent" for value in statuses(worker).values())


def test_telegram_chunks_preserve_full_message_and_fit_utf16_limit():
    payload = {**PAYLOAD, "name": "😀" * 80, "email": "x" * 240 + "@example.com",
               "message": "😀<&>" * 1250}
    parts = telegram_parts("a" * 32, payload)
    assert len(parts) == 4
    for part in parts:
        assert len(unescape(part).encode("utf-16-le")) // 2 < 4096
    assert "".join(unescape(part.split("\n\n", 1)[1]) for part in parts) == payload["message"]


def test_support_email_keeps_original_destination_and_reply_to(setup, monkeypatch):
    worker, _ = setup
    post = Mock(return_value=Mock(status_code=200))
    monkeypatch.setattr("src.services.auth_email.requests.post", post)
    EmailSender(worker.settings).send_support_message(**PAYLOAD, idempotency_key="support-test")
    args = post.call_args.kwargs
    assert args["json"]["to"] == ["greenpeak.fin@gmail.com", "info@greenpeak.ir"]
    assert args["json"]["reply_to"] == PAYLOAD["email"]
    assert args["json"]["from"] != PAYLOAD["email"]
    assert args["headers"]["Idempotency-Key"] == "support-test"


def test_support_recipients_are_not_duplicated(setup, monkeypatch):
    worker, _ = setup
    worker.settings.support_copy_email = worker.settings.support_contact_email
    post = Mock(return_value=Mock(status_code=200))
    monkeypatch.setattr("src.services.auth_email.requests.post", post)
    EmailSender(worker.settings).send_support_message(**PAYLOAD)
    assert post.call_args.kwargs["json"]["to"] == ["greenpeak.fin@gmail.com"]


def test_api_persists_before_background_delivery_and_retains_contract(setup, monkeypatch):
    worker, _ = setup
    monkeypatch.setattr(routes, "get_settings", lambda: worker.settings)
    monkeypatch.setattr(routes, "process_support_notifications", lambda identifier: worker.process(identifier))
    routes._feedback_attempts.clear()
    app = FastAPI(); app.include_router(routes.router, prefix="/api/v1")
    with TestClient(app) as client:
        assert client.post("/api/v1/support/feedback", json={**PAYLOAD, "email": "bad\n@example.com"}).status_code == 422
        assert client.post("/api/v1/support/feedback", json={**PAYLOAD, "message": " " * 5}).status_code == 422
        response = client.post("/api/v1/support/feedback", json=PAYLOAD)
        assert response.status_code == 202 and list(response.json()) == ["message"]
        with worker.connect() as db:
            assert json.loads(db.execute("SELECT payload FROM support_messages").fetchone()[0]) == PAYLOAD
        assert all(state == "sent" for state in statuses(worker).values())
        for _ in range(2):
            assert client.post("/api/v1/support/feedback", json=PAYLOAD).status_code == 202
        assert client.post("/api/v1/support/feedback", json=PAYLOAD).status_code == 429
    routes._feedback_attempts.clear()


def test_storage_failure_is_sanitized_and_does_not_claim_success(setup, monkeypatch):
    worker, _ = setup
    monkeypatch.setattr(routes, "get_settings", lambda: worker.settings)
    monkeypatch.setattr(SupportNotifications, "submit", Mock(side_effect=AuthStorageError("private storage details")))
    routes._feedback_attempts.clear()
    app = FastAPI(); app.include_router(routes.router, prefix="/api/v1")
    response = TestClient(app).post("/api/v1/support/feedback", json=PAYLOAD)
    assert response.status_code == 503 and "private" not in response.text
    routes._feedback_attempts.clear()
