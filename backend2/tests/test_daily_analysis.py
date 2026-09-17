import os
from datetime import datetime
from zoneinfo import ZoneInfo

os.environ["DEBUG"] = "false"

from src.core.config import get_settings
from src.services.daily_analysis import create_daily_analysis_scheduler, should_schedule_catchup


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


def test_catchup_only_runs_after_the_configured_tehran_time():
    timezone = ZoneInfo("Asia/Tehran")
    assert not should_schedule_catchup(datetime(2026, 9, 17, 15, 59, tzinfo=timezone), 16, 0)
    assert should_schedule_catchup(datetime(2026, 9, 17, 16, 0, tzinfo=timezone), 16, 0)
