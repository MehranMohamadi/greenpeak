"""Offline task Telegram outbox, transport safety and workflow regression tests."""

from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
import logging
import sqlite3
from threading import Event
from uuid import uuid4

import httpx
import pytest

from src.core.config import Settings, get_settings
from src.models.work_tasks import TaskCreate, TaskPatch
from src.services.work_task_notifications import (WorkTaskNotificationWorker, create_work_task_notification_scheduler,
                                                  format_due_date)
from src.utils.telegram import send_telegram_market_report, send_telegram_message
from test_work_tasks import harness, action, call, create


@pytest.fixture
def telegram(monkeypatch):
    settings = get_settings()
    for key, value in {"telegram_bot_token": "test-task-token", "telegram_chat_id": "test-existing-destination",
                       "telegram_message_thread_id": 42, "telegram_task_message_thread_id": 88,
                       "auth_public_url": "https://site.example", "environment": "development"}.items():
        monkeypatch.setattr(settings, key, value)
    sent = []
    def post(url, data, timeout):
        sent.append({"url": url, **data})
        return httpx.Response(200, json={"ok": True, "result": {"message_id": len(sent),
                                                               "message_thread_id": int(data["message_thread_id"])}})
    monkeypatch.setattr("src.utils.telegram.httpx.post", post)
    return sent


def worker(h):
    return WorkTaskNotificationWorker(h.repo, clock=lambda: h.clock[0])


def deliveries(h, task):
    return [event["telegram"] for event in h.repo.get(task["id"])["events"] if event.get("telegram")]


def test_employee_team_creation_is_atomic_async_and_uses_existing_bot_and_only_task_topic(harness, telegram):
    h = harness
    task = create(h, visibility="team", due_date="2026-10-26", description="توضیح کار")
    assert telegram == []  # HTTP handler only commits the outbox.
    assert len(deliveries(h, task)) == 1
    assert "telegram" not in task["history"][0] and "creation_request_hash" not in task
    assert worker(h).process() == 1
    message = telegram[0]
    assert message["url"].endswith("bottest-task-token/sendMessage")
    assert message["chat_id"] == "test-existing-destination" and message["message_thread_id"] == "88"
    assert "کار جدید" in message["text"] and "مسئول انجام: worker" in message["text"]
    assert "ایجادکننده: worker" in message["text"] and "اقدام‌کننده: worker" in message["text"]
    assert "۱۴۰۵/۰۸/۰۴" in message["text"]
    assert f'https://site.example/workplace?task={task["id"]}' in message["text"]
    assert "reply_markup" not in message
    assert deliveries(h, task)[0]["status"] == "sent"
    worker(h).process()
    assert len(telegram) == 1
    assert h.repo.get(task["id"])["revision"] == 1


def test_restricted_work_never_queues_any_external_event(harness, telegram):
    h = harness
    task = create(h, "admin", title="SECRET", description="PRIVATE", visibility="restricted")
    task = call(h, "PUT", f'/{task["id"]}', "admin", {"revision": task["revision"], "assignee_id": "3"}).json()
    task = action(h, task, "submit", "other", note="SECRET RESULT").json()
    task = action(h, task, "review", "admin", decision="changes_requested", reason="PRIVATE REASON").json()
    task = action(h, task, "submit", "other").json()
    task = action(h, task, "review", "admin", decision="approved").json()
    assert not deliveries(h, task)
    worker(h).process()
    assert telegram == []
    second = create(h, "admin", visibility="restricted", requires_approval=False)
    action(h, second, "submit")
    worker(h).process()
    assert telegram == []
    # Publishing a formerly restricted work does not replay its private history.
    h.service.patch(h.users["admin"], task["id"], TaskPatch(revision=task["revision"], visibility="team"))
    worker(h).process()
    assert telegram == []


def test_required_events_have_distinct_labels_context_and_no_minor_or_chat_noise(harness, telegram):
    h = harness
    task = create(h, "admin", visibility="team")
    task = call(h, "PUT", f'/{task["id"]}', "admin", {"revision": task["revision"], "assignee_id": "3"}).json()
    task = call(h, "PUT", f'/{task["id"]}', "admin", {"revision": task["revision"], "priority": "high"}).json()
    task = action(h, task, "start", "other").json()
    task = call(h, "POST", f'/{task["id"]}/comments', "other", {"text": "گفت‌وگو"}).json()
    task = action(h, task, "submit", "other", note="خروجی آماده است").json()
    task = action(h, task, "review", "admin", decision="changes_requested", reason="منبع داده را اصلاح کنید").json()
    task = action(h, task, "submit", "other", note="اصلاح شد").json()
    task = action(h, task, "review", "reviewer", decision="approved").json()
    worker(h).process()
    assert len(telegram) == 6
    messages = [message["text"] for message in telegram]
    assert messages[0].startswith("<b>کار جدید</b>")
    assert "واگذاری کار" in messages[1] and "مسئول انجام: other" in messages[1]
    assert messages[2].startswith("<b>منتظر تأیید</b>") and "خروجی آماده است" in messages[2]
    assert messages[3].startswith("<b>نیازمند اصلاح</b>") and "دلیل اصلاح: منبع داده را اصلاح کنید" in messages[3]
    assert messages[5].startswith("<b>تأیید شد</b>") and "اقدام‌کننده: reviewer" in messages[5]
    assert all(message["message_thread_id"] == "88" for message in telegram)


@pytest.mark.parametrize("disable_pending", [False, True])
def test_direct_completion_is_never_admin_approval_and_sends_one_completion(harness, telegram, disable_pending):
    h = harness
    task = create(h, "admin", visibility="team", requires_approval=disable_pending)
    task = action(h, task, "submit", note="نتیجه کار ثبت شد").json()
    if disable_pending:
        task = call(h, "PUT", f'/{task["id"]}', "admin", {"revision": task["revision"], "requires_approval": False}).json()
    worker(h).process()
    assert len(telegram) == (3 if disable_pending else 2)
    assert "بدون نیاز به تأیید" in telegram[-1]["text"]
    assert "نتیجه کار ثبت شد" in telegram[-1]["text"]
    assert "تأیید شد" not in telegram[-1]["text"] and task["approved_by"] is None


def test_visibility_is_rechecked_before_delivery_and_before_safe_retry(harness, telegram, monkeypatch):
    h = harness
    task = create(h, visibility="team")
    def rate_limit(*args, **kwargs):
        return httpx.Response(429, json={"ok": False, "error_code": 429, "parameters": {"retry_after": 30}})
    monkeypatch.setattr("src.utils.telegram.httpx.post", rate_limit)
    worker(h).process()
    assert deliveries(h, task)[0]["status"] == "retry"
    task = call(h, "PUT", f'/{task["id"]}', body={"revision": task["revision"], "visibility": "restricted"}).json()
    h.clock[0] += timedelta(minutes=10)
    worker(h).process()
    assert deliveries(h, task)[0]["status"] == "skipped" and not telegram
    task = call(h, "PUT", f'/{task["id"]}', body={"revision": task["revision"], "visibility": "team"}).json()
    worker(h).process()
    assert not telegram


def test_visibility_change_after_claim_is_checked_again_immediately_before_http(harness, telegram, monkeypatch):
    h = harness
    task = create(h, visibility="team")
    run = worker(h)
    original = run._claim
    def claim(*args):
        token = original(*args)
        h.service.patch(h.users["worker"], task["id"], TaskPatch(revision=1, visibility="restricted"))
        return token
    monkeypatch.setattr(run, "_claim", claim)
    run.process()
    assert not telegram and deliveries(h, task)[0]["status"] == "skipped"


def test_successful_safe_retry_and_multiple_workers_do_not_duplicate(harness, telegram, monkeypatch):
    h = harness
    task = create(h, visibility="team")
    original = __import__("src.utils.telegram", fromlist=["httpx"]).httpx.post
    def offline(*args, **kwargs):
        raise httpx.ConnectError("credential-must-not-be-logged")
    monkeypatch.setattr("src.utils.telegram.httpx.post", offline)
    worker(h).process()
    assert deliveries(h, task)[0]["status"] == "retry"
    h.clock[0] += timedelta(minutes=1)
    entered, release = Event(), Event()
    def paused(*args, **kwargs):
        entered.set()
        assert release.wait(10)
        return original(*args, **kwargs)
    monkeypatch.setattr("src.utils.telegram.httpx.post", paused)
    with ThreadPoolExecutor(2) as pool:
        running = pool.submit(worker(h).process)
        assert entered.wait(5)
        assert pool.submit(worker(h).process).result(timeout=5) == 0
        release.set()
        running.result(timeout=5)
    worker(h).process()
    assert len(telegram) == 1 and deliveries(h, task)[0]["attempts"] == 2


def test_ambiguous_timeout_and_crash_after_acceptance_are_never_automatically_resent(harness, telegram, monkeypatch):
    h = harness
    task = create(h, visibility="team")
    def timeout(*args, **kwargs):
        raise httpx.ReadTimeout("token-and-internal-url")
    original = __import__("src.utils.telegram", fromlist=["httpx"]).httpx.post
    monkeypatch.setattr("src.utils.telegram.httpx.post", timeout)
    worker(h).process()
    assert deliveries(h, task)[0]["status"] == "uncertain"
    monkeypatch.setattr("src.utils.telegram.httpx.post", original)
    another = create(h, visibility="team")
    run = worker(h)
    monkeypatch.setattr(run, "_finish", lambda *args: (_ for _ in ()).throw(RuntimeError("storage down")))
    with pytest.raises(RuntimeError):
        run.process()
    assert len(telegram) == 1
    h.clock[0] += timedelta(minutes=6)
    worker(h).process()
    worker(h).process()
    assert len(telegram) == 1 and deliveries(h, another)[0]["status"] == "uncertain"


def test_missing_or_rejected_topic_never_falls_back_and_does_not_block_task_saves(harness, telegram, monkeypatch):
    h = harness
    monkeypatch.setattr(get_settings(), "telegram_task_message_thread_id", None)
    assert create_work_task_notification_scheduler() is None
    task = create(h, visibility="team")
    worker(h).process()
    assert not telegram and deliveries(h, task)[0]["error_code"] == "task_topic_not_configured"
    task = action(h, task, "submit").json()
    assert task["state"] == "awaiting_approval"
    task = action(h, task, "review", "admin", decision="approved").json()
    assert task["state"] == "completed"
    monkeypatch.setattr(get_settings(), "telegram_task_message_thread_id", 88)
    attempts = []
    def rejected(url, data, timeout):
        attempts.append(data)
        return httpx.Response(400, json={"ok": False, "error_code": 400, "description": "secret must not be logged"})
    monkeypatch.setattr("src.utils.telegram.httpx.post", rejected)
    h.clock[0] += timedelta(minutes=6)
    worker(h).process()
    assert len(attempts) == 1 and attempts[0]["message_thread_id"] == "88"
    assert deliveries(h, task)[0]["status"] == "blocked"


def test_html_length_deadlines_links_acl_and_secret_safe_errors(harness, telegram, monkeypatch, caplog):
    h = harness
    task = create(h, visibility="team", title='<b>"title" & data</b>', description='</a><script>bad</script> ' + '&' * 5000)
    worker(h).process()
    text = telegram[0]["text"]
    assert "&lt;b&gt;" in text and "<script>" not in text and len(text) < 3900 and "…" in text
    assert call(h, "GET", f'/{task["id"]}', name=None).status_code == 401
    assert call(h, "GET", f'/{task["id"]}', name="regular").status_code == 403
    assert call(h, "GET", f'/{task["id"]}', name="other").status_code == 200
    assert action(h, task, "review", "other", decision="approved").status_code == 403
    create(h, visibility="team", description="PRIVATE BODY")
    def private_failure(url, **kwargs):
        logging.getLogger("httpx").info("HTTP Request: POST %s", url)
        raise httpx.ReadTimeout("test-task-token PRIVATE BODY")
    monkeypatch.setattr("src.utils.telegram.httpx.post", private_failure)
    with caplog.at_level(logging.INFO):
        worker(h).process()
    assert "test-task-token" not in caplog.text and "PRIVATE BODY" not in caplog.text
    assert "telegram_delivery_outcome_unknown" in caplog.text


def test_creation_request_id_and_revision_make_repeated_clicks_idempotent(harness, telegram):
    h = harness
    body = TaskCreate(title="Repeated", request_id=uuid4(), visibility="team")
    with ThreadPoolExecutor(2) as pool:
        results = list(pool.map(lambda _: h.service.create(h.users["worker"], body), range(2)))
    assert results[0]["id"] == results[1]["id"] and len(h.repo.all()) == 1
    task = results[0]
    assert action(h, task, "submit").status_code == 200
    assert action(h, task, "submit").status_code == 409
    worker(h).process()
    assert len(telegram) == 2
    changed = body.model_copy(update={"title": "Different"})
    with pytest.raises(Exception, match="اطلاعات دیگری"):
        h.service.create(h.users["worker"], changed)


def test_failed_task_commit_does_not_send_or_leave_an_outbox_event(harness, telegram, monkeypatch):
    h = harness
    def unavailable(document):
        raise sqlite3.OperationalError("private storage detail")
    monkeypatch.setattr(h.repo, "create", unavailable)
    response = call(h, "POST", body={"title": "Not committed", "visibility": "team"})
    assert response.status_code == 503 and "private" not in response.text
    assert h.repo.all() == []
    worker(h).process()
    assert not telegram


def test_existing_market_report_keeps_its_own_destination_topic(telegram):
    assert send_telegram_market_report({"current_market_move_fa": "حرکت بازار", "summary_points_fa": ["جمع‌بندی"]})
    assert len(telegram) == 1 and telegram[0]["message_thread_id"] == "42"
    assert "اکنون" in telegram[0]["text"] and "جمع‌بندی" in telegram[0]["text"]


@pytest.mark.parametrize("value", [None, "", "Task", "0", "1", -2, True, 1.5])
def test_invalid_task_topic_fails_closed_without_breaking_settings(value, telegram):
    settings = Settings(_env_file=None, telegram_task_message_thread_id=value)
    assert settings.telegram_task_message_thread_id is None
    result = send_telegram_message("must not send", value, settings=get_settings(), require_topic=True)
    assert result.status == "blocked" and not telegram


def test_task_scheduler_is_independent_of_analysis_and_llm_configuration(telegram, monkeypatch):
    monkeypatch.setattr(get_settings(), "greenpeak_daily_analysis_enabled", False)
    scheduler = create_work_task_notification_scheduler()
    assert scheduler is not None
    assert [job.id for job in scheduler.get_jobs()] == ["greenpeak-work-task-telegram"]


@pytest.mark.parametrize("value,expected", [("2026-10-26", "۱۴۰۵/۰۸/۰۴"), ("2025-03-20", "۱۴۰۳/۱۲/۳۰"),
    ("2025-03-21", "۱۴۰۴/۰۱/۰۱"), ("2026-03-20", "۱۴۰۴/۱۲/۲۹"), ("2026-03-21", "۱۴۰۵/۰۱/۰۱"),
    ("2124-03-23", "۱۵۰۳/۰۱/۰۴")])
def test_deadlines_match_numeric_site_calendar(value, expected):
    assert format_due_date(value) == expected
