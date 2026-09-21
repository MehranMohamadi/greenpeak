import os
from datetime import date, datetime
from zoneinfo import ZoneInfo

os.environ["DEBUG"] = "false"

from src.core.config import get_settings
from src.services.daily_analysis import (
    _deliver_daily_notification,
    _market_report_date,
    create_daily_analysis_scheduler,
    market_analysis_completed,
    next_scheduled_analysis_at,
    should_schedule_catchup,
)


class FakeRuns:
    def __init__(self, run):
        self.run = run
        self.updates = []

    def find_one_and_update(self, query, update, return_document):
        assert query["status"]["$in"] == ["success", "partial"]
        assert self.run["notification"]["status"] in query["notification.status"]["$in"]
        self.run["notification"]["status"] = update["$set"]["notification.status"]
        self.run["notification"]["attempts"] += update["$inc"]["notification.attempts"]
        return self.run

    def update_one(self, query, update):
        self.updates.append((query, update))


def test_daily_scheduler_can_be_disabled(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "greenpeak_daily_analysis_enabled", False)
    assert create_daily_analysis_scheduler() is None


def test_daily_scheduler_uses_configured_time(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "greenpeak_daily_analysis_enabled", True)
    monkeypatch.setattr(settings, "greenpeak_llm_provider", "openai-compatible")
    monkeypatch.setattr(settings, "greenpeak_llm_api_key", "test-key")
    monkeypatch.setattr(settings, "greenpeak_llm_model", "test-model")
    monkeypatch.setattr(settings, "greenpeak_daily_analysis_hour", 6)
    monkeypatch.setattr(settings, "greenpeak_daily_analysis_minute", 30)
    scheduler = create_daily_analysis_scheduler()
    assert scheduler is not None
    job = scheduler.get_job("greenpeak-daily-analysis")
    assert str(job.trigger) == "cron[hour='6', minute='30']"
    retry_job = scheduler.get_job("greenpeak-daily-analysis-notification-retry")
    assert str(retry_job.trigger) == "cron[minute='*/10']"


def test_catchup_only_runs_after_the_configured_tehran_time():
    timezone = ZoneInfo("Asia/Tehran")
    assert not should_schedule_catchup(datetime(2026, 9, 17, 15, 59, tzinfo=timezone), 16, 0)
    assert should_schedule_catchup(datetime(2026, 9, 17, 16, 0, tzinfo=timezone), 16, 0)


def test_next_scheduled_analysis_uses_configured_tehran_time(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "greenpeak_daily_analysis_enabled", True)
    monkeypatch.setattr(settings, "greenpeak_llm_provider", "openai-compatible")
    monkeypatch.setattr(settings, "greenpeak_llm_api_key", "test-key")
    monkeypatch.setattr(settings, "greenpeak_llm_model", "test-model")
    monkeypatch.setattr(settings, "greenpeak_daily_analysis_hour", 16)
    monkeypatch.setattr(settings, "greenpeak_daily_analysis_minute", 0)
    timezone = ZoneInfo("Asia/Tehran")

    next_run = next_scheduled_analysis_at(datetime(2026, 9, 17, 16, 1, tzinfo=timezone))

    assert next_run == datetime(2026, 9, 18, 16, 0, tzinfo=timezone)


def test_partial_run_with_market_analysis_is_notification_eligible():
    result = {"errors": ["an_indicator:ReadTimeout"], "llm": {"market": {"status": "generated"}}}
    assert market_analysis_completed(result)
    assert not market_analysis_completed({"errors": [], "llm": {"market": None}})


def test_market_report_date_uses_current_market_document():
    assert _market_report_date({"market": {"as_of_date": date(2026, 9, 21)}}) == "2026-09-21"
    assert _market_report_date({"data_as_of": "2026-09-20T12:00:00Z"}) == "2026-09-20"


def test_partial_run_sends_and_records_current_market_notification(monkeypatch):
    runs = FakeRuns(
        {
            "run_key": "daily:2026-09-21",
            "status": "partial",
            "result": {"llm": {"market": {"status": "generated"}}},
            "notification": {"status": "pending", "attempts": 0},
        }
    )
    monkeypatch.setattr(
        "src.services.daily_analysis.build_telegram_market_report",
        lambda client, database: {"market": {"as_of_date": "2026-09-21"}},
    )
    monkeypatch.setattr("src.services.daily_analysis.send_telegram_market_report", lambda report: True)

    _deliver_daily_notification(object(), runs, "daily:2026-09-21", date(2026, 9, 21))

    assert runs.run["notification"]["attempts"] == 1
    assert runs.updates[-1][1]["$set"]["notification.status"] == "sent"
    assert runs.updates[-1][1]["$set"]["notification.error_code"] is None


def test_notification_does_not_send_a_stale_market_report(monkeypatch):
    runs = FakeRuns(
        {
            "run_key": "daily:2026-09-21",
            "status": "partial",
            "result": {"llm": {"market": {"status": "generated"}}},
            "notification": {"status": "pending", "attempts": 0},
        }
    )
    monkeypatch.setattr(
        "src.services.daily_analysis.build_telegram_market_report",
        lambda client, database: {"market": {"as_of_date": "2026-09-20"}},
    )
    sent = []
    monkeypatch.setattr("src.services.daily_analysis.send_telegram_market_report", lambda report: sent.append(report))

    _deliver_daily_notification(object(), runs, "daily:2026-09-21", date(2026, 9, 21))

    assert not sent
    assert runs.updates[-1][1]["$set"] == {
        "notification.status": "failed",
        "notification.error_code": "market_report_date_mismatch",
    }
