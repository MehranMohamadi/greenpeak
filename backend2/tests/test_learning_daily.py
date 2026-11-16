"""Offline schedule, delivery receipts, retry boundaries and spoiler rendering."""

from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from datetime import datetime, timedelta
import json
from types import SimpleNamespace
from zoneinfo import ZoneInfo

import pytest

from src.core.config import Settings
from src.services import learning_daily as learning
from src.utils.telegram import TelegramDeliveryResult, send_telegram_message


TEHRAN = ZoneInfo("Asia/Tehran")


@pytest.fixture
def settings(tmp_path):
    return SimpleNamespace(
        greenpeak_learning_enabled=True, greenpeak_learning_hour=7, greenpeak_learning_minute=0,
        greenpeak_learning_catchup_minutes=120, greenpeak_learning_db_path=tmp_path / "learning.db",
        telegram_bot_token="test-only", telegram_chat_id="-100test",
        telegram_learning_message_thread_id=10, telegram_message_thread_id=42,
        telegram_task_message_thread_id=99, auth_public_url="https://example.test",
        environment="production",
    )


@pytest.fixture
def bank():
    return learning.load_learning_bank()


def morning(day=16, hour=7, minute=0):
    return datetime(2026, 11, day, hour, minute, tzinfo=TEHRAN)


def worker(settings, *, bank=None, now=None, sender=None):
    return learning.LearningDailyWorker(settings, bank=bank,
                                       clock=lambda: now or morning(), sender=sender)


def test_all_posts_start_with_question_and_hide_answers(bank):
    for item in bank["items"]:
        payload = learning.learning_message(bank, item, "https://example.test/")
        text = payload["text"]
        assert text.startswith(learning.escape(item["question_fa"]))
        visible, hidden = text.split("<tg-spoiler>")
        answer, references = hidden.split("</tg-spoiler>")
        for field in ("answer_fa", "explanation_fa", "takeaway_fa"):
            assert learning.escape(item[field]) in answer
            assert learning.escape(item[field]) not in visible
        assert "منبع:" in references
        assert all(bank["sources"][r["source_id"]]["url"] in references for r in item["source_refs"])
        assert len(text.encode("utf-16-le")) // 2 < 3900
        assert payload["reply_markup"]["inline_keyboard"][0][0]["url"] == "https://example.test/learn/risk-management"


def test_spoiler_cannot_be_broken_by_authored_html(bank):
    item = deepcopy(bank["items"][0])
    item["answer_fa"] = '</tg-spoiler><b>injected & text</b>'
    text = learning.learning_message(bank, item, "https://example.test")["text"]
    assert text.count("</tg-spoiler>") == 1
    assert "&lt;/tg-spoiler&gt;" in text
    assert "&amp;" in text


@pytest.mark.parametrize("hour,minute,due", [(6, 59, False), (7, 0, True), (8, 59, True), (9, 0, False), (23, 0, False)])
def test_window_includes_limited_same_day_catchup(settings, hour, minute, due):
    assert learning.learning_window(morning(hour=hour, minute=minute), settings) == ("2026-11-16", due)


def test_schedule_uses_tehran_even_when_clock_is_utc(settings):
    utc_time = datetime.fromisoformat("2026-11-16T03:30:00+00:00")
    assert learning.learning_window(utc_time, settings)[1]
    with pytest.raises(ValueError, match="timezone_aware"):
        learning.learning_window(datetime(2026, 11, 16, 7), settings)


def test_disabled_and_before_time_do_not_create_ledger_or_send(settings):
    calls = []
    assert worker(settings, now=morning(hour=6), sender=lambda *a, **k: calls.append(a)).process()["status"] == "outside_window"
    settings.greenpeak_learning_enabled = False
    assert worker(settings, sender=lambda *a, **k: calls.append(a)).process()["status"] == "disabled"
    assert not calls and not settings.greenpeak_learning_db_path.exists()


@pytest.mark.parametrize("topic", [None, True, 1, 0, -10, "10", 10.5])
def test_bad_topic_never_uses_other_topics_or_general(settings, topic):
    settings.telegram_learning_message_thread_id = topic
    calls = []
    result = worker(settings, sender=lambda *a, **k: calls.append(a)).process()
    assert result == {"status": "blocked", "error_code": "learning_topic_not_configured"}
    assert not calls and not settings.greenpeak_learning_db_path.exists()


@pytest.mark.parametrize("value,expected", [("10", 10), ("", None), ("abc", None), (1, None), (False, None), (10.0, None)])
def test_settings_accept_topic_or_disable_invalid_value(value, expected):
    assert Settings.learning_topic_or_disabled(value) == expected


@pytest.mark.parametrize("url", ["http://localhost:3000", "https://localhost", "https://user:secret@example.test", "https://example.test?token=secret", "/learn"])
def test_invalid_production_public_url_blocks_sending(settings, url):
    settings.auth_public_url = url
    assert learning.learning_configuration_error(settings).startswith("learning_public_url_")


def test_restart_or_second_worker_does_not_repeat_same_day(settings, bank):
    calls = []
    def sender(text, topic, **kwargs):
        calls.append((text, topic, kwargs))
        return TelegramDeliveryResult("sent", message_id=123)
    result = worker(settings, bank=bank, sender=sender).process()
    assert result["status"] == "sent" and result["item_id"] == "risk-001"
    assert worker(settings, bank=bank, sender=sender).process() == {"status": "sent", "claimed": False}
    assert calls[0][1] == 10
    assert calls[0][2]["require_topic"] is True
    assert len(calls) == 1
    history = learning.LearningDeliveryStore(settings.greenpeak_learning_db_path).history()
    assert history[0]["message_id"] == 123 and history[0]["content_version"] == "risk-daily-1"


def test_concurrent_workers_claim_only_one_delivery(settings, bank):
    calls = []
    def sender(*args, **kwargs):
        calls.append(1)
        return TelegramDeliveryResult("sent", message_id=123)
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(lambda _: worker(settings, bank=bank, sender=sender).process(), range(8)))
    assert len(calls) == 1
    assert sum(result.get("item_id") == "risk-001" for result in results) == 1


def test_rate_limit_retries_the_frozen_post_after_required_delay(settings, bank):
    now = [morning()]
    sent = []
    def sender(text, topic, **kwargs):
        sent.append((text, kwargs["reply_markup"]))
        return TelegramDeliveryResult("retry", "telegram_rate_limited", retry_after=90) if len(sent) == 1 else TelegramDeliveryResult("sent", message_id=2)
    w = learning.LearningDailyWorker(settings, bank=bank, sender=sender, clock=lambda: now[0])
    assert w.process()["status"] == "retry"
    now[0] += timedelta(seconds=60)
    bank["items"][0]["answer_fa"] = "changed content must not replace a queued message"
    assert w.process() == {"status": "retry", "claimed": False}
    now[0] += timedelta(seconds=30)
    assert w.process()["status"] == "sent"
    assert sent[0] == sent[1]


@pytest.mark.parametrize("outcome", ["uncertain", "exception", "no_receipt"])
def test_ambiguous_delivery_is_not_resent(settings, bank, outcome):
    sent = []
    def sender(*args, **kwargs):
        sent.append(1)
        if outcome == "exception":
            raise RuntimeError("contains a sensitive URL")
        if outcome == "no_receipt":
            return TelegramDeliveryResult("sent")
        return TelegramDeliveryResult("uncertain", "telegram_delivery_outcome_unknown")
    assert worker(settings, bank=bank, sender=sender).process()["status"] == "uncertain"
    assert worker(settings, bank=bank, now=morning(minute=10), sender=sender).process()["status"] == "uncertain"
    assert len(sent) == 1
    assert "sensitive" not in str(learning.LearningDeliveryStore(settings.greenpeak_learning_db_path).history())


def test_interrupted_claim_is_recorded_unknown_without_resending(settings, bank):
    store = learning.LearningDeliveryStore(settings.greenpeak_learning_db_path)
    row, _ = store.claim("2026-11-16", settings.telegram_chat_id, 10, morning().timestamp(), bank, settings.auth_public_url)
    sent = []
    assert worker(settings, bank=bank, now=morning(minute=6), sender=lambda *a, **k: sent.append(a)).process()["status"] == "uncertain"
    assert not sent
    assert store.history()[0]["error_code"] == "learning_delivery_interrupted"
    # A late completion cannot overwrite the terminal state after lease expiry.
    assert store.finish(row, TelegramDeliveryResult("sent", message_id=1), morning(minute=6).timestamp()) == "uncertain"


def test_expired_yesterday_is_not_backfilled(settings, bank):
    def retry(*args, **kwargs):
        return TelegramDeliveryResult("retry", "telegram_connection_failed")
    assert worker(settings, bank=bank, sender=retry).process()["status"] == "retry"
    calls = []
    def sent(text, *args, **kwargs):
        calls.append(text)
        return TelegramDeliveryResult("sent", message_id=3)
    result = worker(settings, bank=bank, now=morning(day=17), sender=sent).process()
    assert result["item_id"] == "risk-002" and len(calls) == 1
    assert "risk-001" not in calls[0]
    history = learning.LearningDeliveryStore(settings.greenpeak_learning_db_path).history()
    assert history[1]["status"] == "expired"


def test_weekends_and_new_cycle_keep_daily_cadence(settings, bank):
    # 2026-11-21 is Saturday; there is no market-weekday restriction.
    calls = []
    def sender(text, *a, **k):
        calls.append(text)
        return TelegramDeliveryResult("sent", message_id=len(calls))
    start = morning(day=21)
    ids = [worker(settings, bank=bank, now=start + timedelta(days=i), sender=sender).process()["item_id"] for i in range(31)]
    assert ids[:30] == [item["id"] for item in bank["items"]]
    assert ids[30] == "risk-001"


def test_content_revision_does_not_send_twice_on_same_day(settings, bank):
    def sender(*a, **k):
        return TelegramDeliveryResult("sent", message_id=1)
    assert worker(settings, bank=bank, sender=sender).process()["status"] == "sent"
    bank["content_version"] = "risk-daily-2"
    assert worker(settings, bank=bank, sender=sender).process() == {"status": "sent", "claimed": False}


def test_retry_limit(settings, bank):
    now = [morning()]
    calls = []
    def sender(*a, **k):
        calls.append(1)
        return TelegramDeliveryResult("retry", "telegram_connection_failed")
    w = learning.LearningDailyWorker(settings, bank=bank, clock=lambda: now[0], sender=sender)
    for index in range(8):
        result = w.process()
        now[0] += timedelta(seconds=min(3600, 30 * 2 ** index))
    assert result["status"] == "failed" and len(calls) == 8


def test_scheduler_daily_and_retry_jobs_are_disabled_by_default(settings, monkeypatch):
    monkeypatch.setattr(learning, "get_settings", lambda: settings)
    scheduler = learning.create_learning_daily_scheduler()
    trigger = scheduler.get_job("greenpeak-learning-daily").trigger
    next_fire = trigger.get_next_fire_time(None, morning(hour=6))
    assert next_fire == morning()
    assert str(trigger.timezone) == "Asia/Tehran"
    assert scheduler.get_job("greenpeak-learning-retry").trigger.interval.total_seconds() == 60
    settings.greenpeak_learning_enabled = False
    assert learning.create_learning_daily_scheduler() is None


def test_preview_has_no_network_or_ledger_side_effects(settings, monkeypatch, capsys):
    monkeypatch.setattr(learning, "get_settings", lambda: settings)
    monkeypatch.setattr("sys.argv", ["learning_daily", "preview", "--sequence", "1"])
    monkeypatch.setattr(learning, "send_telegram_message", lambda *a, **k: pytest.fail("preview sent a message"))
    learning.main()
    preview = json.loads(capsys.readouterr().out)
    assert preview["dry_run"] is True and preview["topic_id"] == 10
    assert not settings.greenpeak_learning_db_path.exists()


def test_transport_json_serializes_keyboard_and_verifies_topic(settings, monkeypatch):
    captured = {}
    class Response:
        status_code = 200
        def json(self):
            return {"ok": True, "result": {"message_thread_id": 10, "message_id": 456}}
    def post(url, data, timeout):
        captured.update(data)
        return Response()
    monkeypatch.setattr("src.utils.telegram.httpx.post", post)
    keyboard = {"inline_keyboard": [[{"text": "lesson", "url": "https://example.test/learn"}]]}
    result = send_telegram_message("<tg-spoiler>answer</tg-spoiler>", 10, settings=settings, require_topic=True, reply_markup=keyboard)
    assert result.status == "sent" and result.message_id == 456
    assert captured["message_thread_id"] == "10"
    assert captured["parse_mode"] == "HTML" and json.loads(captured["reply_markup"]) == keyboard


def test_health_and_app_lifecycle_include_learning_scheduler(monkeypatch):
    import src.main as app_module
    from fastapi.testclient import TestClient
    starts, stops = [], []
    class Scheduler:
        def start(self):
            starts.append(True)
        def shutdown(self, wait):
            stops.append(wait)
    for factory in ("create_daily_analysis_scheduler", "create_news_scheduler", "create_official_sentiment_scheduler",
                    "create_work_task_notification_scheduler", "create_support_notification_scheduler"):
        monkeypatch.setattr(app_module, factory, lambda: None)
    monkeypatch.setattr(app_module, "create_learning_daily_scheduler", Scheduler)
    with TestClient(app_module.create_app()) as client:
        assert client.get("/health").json()["status"] == "healthy"
        assert starts == [True]
    assert stops == [False]
