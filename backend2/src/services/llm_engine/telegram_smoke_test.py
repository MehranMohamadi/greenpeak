"""Explicit, one-shot LLM/Telegram probe; never runs on application startup."""

import argparse
from datetime import UTC, datetime, timedelta
import html
import json
import sqlite3
from zoneinfo import ZoneInfo

from pydantic import BaseModel, Field

from ...core.config import get_settings
from ...utils.telegram import send_telegram_message
from .routing import create_llm_provider, generate_validated_json, llm_is_configured


class SmokeReply(BaseModel):
    message_fa: str = Field(min_length=1, max_length=400)


def run_probe(scheduled_at, *, settings=None, now=None, dry_run=False):
    settings = settings or get_settings()
    if scheduled_at.tzinfo is None:
        raise ValueError("An explicit timezone is required")
    scheduled_at = scheduled_at.astimezone(UTC)
    now = now or datetime.now(UTC)
    run_id = scheduled_at.isoformat()
    if not (llm_is_configured(settings) and settings.telegram_bot_token
            and settings.telegram_chat_id and settings.telegram_message_thread_id
            and settings.telegram_message_thread_id > 1):
        return {"run_id": run_id, "status": "not_configured"}
    if dry_run:
        return {"run_id": run_id, "status": "dry_run",
                "providers": [p.provider_id for p in settings.greenpeak_llm_providers]}
    if now < scheduled_at or now > scheduled_at + timedelta(minutes=5):
        return {"run_id": run_id, "status": "outside_execution_window"}

    path = settings.greenpeak_llm_router_db_path.with_name("llm_telegram_smoke.db")
    path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(path, timeout=10) as db:
        db.execute("CREATE TABLE IF NOT EXISTS smoke_runs "
                   "(run_id TEXT PRIMARY KEY, result TEXT NOT NULL)")
        claimed = db.execute("INSERT OR IGNORE INTO smoke_runs VALUES (?, ?)",
                             (run_id, json.dumps({"status": "running"}))).rowcount
    if not claimed:
        return {"run_id": run_id, "status": "already_attempted"}

    result = {"run_id": run_id}
    local_time = scheduled_at.astimezone(ZoneInfo("Asia/Tehran")).strftime("%Y-%m-%d %H:%M")
    text = f"<b>تست یک‌بارهٔ LLM و تلگرام</b>\nزمان تهران: {local_time}\n"
    try:
        provider = create_llm_provider(settings)
        reply = generate_validated_json(provider,
            "Return only JSON matching the output contract. In one short Persian sentence, "
            "confirm this is a connectivity test. Do not provide market data or analysis.",
            {"output_contract": SmokeReply.model_json_schema()}, SmokeReply.model_validate)
        result.update(provider=provider.provider_id, model=provider.model_id)
        text += (f"مدل: {html.escape(provider.provider_id)} / {html.escape(provider.model_id)}\n"
                 + html.escape(reply.message_fa))
    except Exception as exc:
        # Provider errors may contain credentials or response bodies. Store only the type.
        result["llm_error"] = type(exc).__name__
        text += "درخواست آزمایشی مدل ناموفق بود؛ مسیر تلگرام جداگانه بررسی می‌شود."
    delivery = send_telegram_message(text, settings.telegram_message_thread_id,
                                     settings=settings, require_topic=True)
    result.update(status=delivery.status, telegram_error=delivery.error_code,
                  message_id=delivery.message_id, finished_at=datetime.now(UTC).isoformat())
    # Never automatically retry: Telegram cannot guarantee idempotent delivery.
    with sqlite3.connect(path, timeout=10) as db:
        db.execute("UPDATE smoke_runs SET result=? WHERE run_id=?",
                   (json.dumps(result), run_id))
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--scheduled-at", required=True, type=datetime.fromisoformat)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    result = run_probe(args.scheduled_at, dry_run=args.dry_run)
    print(json.dumps(result))
    return 0 if result["status"] in {"dry_run", "already_attempted", "sent"} and not result.get("llm_error") else 1


if __name__ == "__main__":
    raise SystemExit(main())
