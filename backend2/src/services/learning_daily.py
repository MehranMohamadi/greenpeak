"""Authored daily learning posts, with a durable per-topic/day delivery ledger."""

import argparse
from contextlib import closing, contextmanager
from datetime import datetime, timedelta, timezone
from html import escape
import json
import logging
from pathlib import Path
import sqlite3
from urllib.parse import urlsplit
from uuid import uuid4
from zoneinfo import ZoneInfo

from apscheduler.schedulers.background import BackgroundScheduler

from ..core.config import get_settings
from ..utils.telegram import TelegramDeliveryResult, send_telegram_message


logger = logging.getLogger(__name__)
BANK_PATH = Path(__file__).resolve().parents[1] / "data" / "learning" / "risk_daily_v1.json"
TEHRAN = ZoneInfo("Asia/Tehran")
UTC = timezone.utc
MAX_ATTEMPTS = 8
CLAIM_SECONDS = 300
READY = {"pending", "retry", "blocked"}
FIELDS = ("question_fa", "answer_fa", "explanation_fa", "takeaway_fa")


def load_learning_bank(path=BANK_PATH):
    """Fail closed on malformed content; no runtime generation or remote fetching."""
    bank = json.loads(Path(path).read_text(encoding="utf-8"))
    if bank.get("schema_version") != "1.0" or not bank.get("content_version"):
        raise ValueError("learning_bank_version_invalid")
    items = bank.get("items", [])
    lessons = {lesson["id"] for lesson in bank["lessons"]}
    if (not items or len({item["id"] for item in items}) != len(items)
            or [item["sequence"] for item in items] != list(range(1, len(items) + 1))
            or bank.get("course_path") != "/learn/risk-management"):
        raise ValueError("learning_bank_structure_invalid")
    for item in items:
        if item["lesson_id"] not in lessons or not item.get("source_refs"):
            raise ValueError("learning_bank_reference_invalid")
        for field in FIELDS:
            if not isinstance(item.get(field), str) or not item[field].strip():
                raise ValueError("learning_bank_text_invalid")
        for ref in item["source_refs"]:
            source = bank["sources"][ref["source_id"]]
            url = urlsplit(source["url"])
            if url.scheme != "https" or not url.hostname or url.username or url.password:
                raise ValueError("learning_bank_source_invalid")
    return bank


def learning_configuration_error(settings):
    topic = settings.telegram_learning_message_thread_id
    if not isinstance(topic, int) or isinstance(topic, bool) or topic <= 1:
        return "learning_topic_not_configured"
    if not settings.telegram_bot_token or not settings.telegram_chat_id:
        return "telegram_not_configured"
    try:
        url = urlsplit(settings.auth_public_url)
        if (url.scheme not in {"https", "http"} or not url.hostname or url.username or url.password
                or url.query or url.fragment or len(settings.auth_public_url) > 300):
            return "learning_public_url_invalid"
        if settings.environment == "production" and (
                url.scheme != "https" or url.hostname in {"localhost", "127.0.0.1", "::1"}):
            return "learning_public_url_not_configured"
    except ValueError:
        return "learning_public_url_invalid"
    return None


def learning_message(bank, item, public_url):
    """Keep all answer-bearing fields hidden in one spoiler; HTML-escape input."""
    hidden = "\n\n".join(
        f"<b>{label}</b>\n{escape(item[field])}"
        for label, field in (("پاسخ", "answer_fa"), ("درس کوتاه", "explanation_fa"),
                             ("یادت بماند", "takeaway_fa"))
    )
    refs = []
    for ref in item["source_refs"]:
        source = bank["sources"][ref["source_id"]]
        refs.append(f'<a href="{escape(source["url"], quote=True)}">{escape(source["publisher"])}</a>')
    number = str(item["sequence"]).translate(str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹"))
    text = (f"{escape(item['question_fa'])}\n\n"
            f"مدیریت ریسک · نکتهٔ {number}\n"
            "اول خودت جواب بده؛ سپس برای دیدن پاسخ روی بخش پوشیده بزن.\n\n"
            f"<tg-spoiler>{hidden}</tg-spoiler>\n\nمنبع: " + " · ".join(refs))
    if item["scope"] == "course_extension":
        text += "\nنکتهٔ تکمیلیِ دوره"
    if len(text.encode("utf-16-le")) // 2 > 3900:
        raise ValueError("learning_message_too_long")
    keyboard = {"inline_keyboard": [[{
        "text": "مطالعهٔ درس مدیریت ریسک",
        "url": public_url.rstrip("/") + bank["course_path"],
    }]]}
    return {"text": text, "reply_markup": keyboard}


def learning_window(now, settings):
    if now.tzinfo is None:
        raise ValueError("learning_clock_must_be_timezone_aware")
    local = now.astimezone(TEHRAN)
    due = local.replace(hour=settings.greenpeak_learning_hour, minute=settings.greenpeak_learning_minute,
                        second=0, microsecond=0)
    # Never catch up yesterday's post or emit a backlog after a long outage.
    end = min(due + timedelta(minutes=settings.greenpeak_learning_catchup_minutes),
              (due + timedelta(days=1)).replace(hour=0, minute=0))
    return local.date().isoformat(), due <= local < end


class LearningDeliveryStore:
    def __init__(self, path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as db:
            db.execute("""CREATE TABLE IF NOT EXISTS learning_deliveries (
                local_date TEXT NOT NULL, chat_id TEXT NOT NULL, topic_id INTEGER NOT NULL,
                ordinal INTEGER NOT NULL, content_version TEXT NOT NULL, item_id TEXT NOT NULL,
                message_text TEXT NOT NULL, reply_markup TEXT NOT NULL,
                status TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
                available_at REAL NOT NULL, created_at REAL NOT NULL,
                claimed_at REAL, claim_id TEXT, message_id INTEGER, error_code TEXT, sent_at REAL,
                PRIMARY KEY (chat_id, topic_id, local_date)
            )""")

    @contextmanager
    def connect(self):
        with closing(sqlite3.connect(self.path, timeout=15)) as db:
            db.row_factory = sqlite3.Row
            with db:
                yield db

    def claim(self, date, chat, topic, now, bank, public_url):
        with self.connect() as db:
            # All workers must share this local persistent DB. No HTTP under lock.
            db.execute("BEGIN IMMEDIATE")
            db.execute("""UPDATE learning_deliveries SET status='uncertain',
                error_code='learning_delivery_interrupted' WHERE chat_id=? AND topic_id=?
                AND status='sending' AND claimed_at <= ?""", (chat, topic, now - CLAIM_SECONDS))
            db.execute("""UPDATE learning_deliveries SET status='expired', error_code='learning_day_expired'
                WHERE chat_id=? AND topic_id=? AND local_date < ? AND status IN ('pending','retry','blocked')""",
                       (chat, topic, date))
            key = (chat, topic, date)
            row = db.execute("SELECT * FROM learning_deliveries WHERE chat_id=? AND topic_id=? AND local_date=?", key).fetchone()
            if row is None:
                ordinal = db.execute("SELECT COALESCE(MAX(ordinal), -1)+1 FROM learning_deliveries WHERE chat_id=? AND topic_id=?",
                                     (chat, topic)).fetchone()[0]
                item = bank["items"][ordinal % len(bank["items"])]
                payload = learning_message(bank, item, public_url)
                db.execute("""INSERT INTO learning_deliveries
                    (local_date,chat_id,topic_id,ordinal,content_version,item_id,message_text,reply_markup,status,available_at,created_at)
                    VALUES (?,?,?,?,?,?,?,?,'pending',?,?)""",
                           (date, chat, topic, ordinal, bank["content_version"], item["id"], payload["text"],
                            json.dumps(payload["reply_markup"], ensure_ascii=False), now, now))
                row = db.execute("SELECT * FROM learning_deliveries WHERE chat_id=? AND topic_id=? AND local_date=?", key).fetchone()
            if row["status"] not in READY or row["available_at"] > now:
                return None, row["status"]
            if row["attempts"] >= MAX_ATTEMPTS:
                db.execute("UPDATE learning_deliveries SET status='failed', error_code='learning_attempts_exhausted' WHERE chat_id=? AND topic_id=? AND local_date=?", key)
                return None, "failed"
            claim_id = str(uuid4())
            db.execute("""UPDATE learning_deliveries SET status='sending', attempts=attempts+1,
                claimed_at=?,claim_id=?,error_code=NULL WHERE chat_id=? AND topic_id=? AND local_date=?""",
                       (now, claim_id, *key))
            return dict(db.execute("SELECT * FROM learning_deliveries WHERE chat_id=? AND topic_id=? AND local_date=?", key).fetchone()), "sending"

    def finish(self, row, result, now):
        state = result.status if result.status in {"sent", "retry", "blocked", "uncertain"} else "uncertain"
        if state == "retry" and row["attempts"] >= MAX_ATTEMPTS:
            state = "failed"
        delay = max(result.retry_after or 0, min(3600, 30 * 2 ** (row["attempts"] - 1)),
                    300 if state == "blocked" else 0)
        with self.connect() as db:
            changed = db.execute("""UPDATE learning_deliveries SET status=?, available_at=?,
                error_code=?, message_id=?, sent_at=? WHERE chat_id=? AND topic_id=? AND local_date=?
                AND status='sending' AND claim_id=?""",
                                 (state, now + delay, result.error_code, result.message_id,
                                  now if state == "sent" else None, row["chat_id"], row["topic_id"],
                                  row["local_date"], row["claim_id"])).rowcount
        return state if changed else "uncertain"

    def history(self, limit=30):
        with self.connect() as db:
            return [dict(row) for row in db.execute("""SELECT local_date,ordinal,content_version,item_id,
                status,attempts,message_id,error_code FROM learning_deliveries
                ORDER BY created_at DESC LIMIT ?""", (limit,))]


class LearningDailyWorker:
    def __init__(self, settings=None, *, store=None, sender=None, clock=None, bank=None):
        self.settings = settings or get_settings()
        self.store = store
        self.sender = sender or send_telegram_message
        self.clock = clock or (lambda: datetime.now(UTC))
        self.bank = bank

    def process(self):
        s = self.settings
        if not s.greenpeak_learning_enabled:
            return {"status": "disabled"}
        error = learning_configuration_error(s)
        if error:
            return {"status": "blocked", "error_code": error}
        now = self.clock()
        date, due = learning_window(now, s)
        if not due:
            return {"status": "outside_window"}
        bank = self.bank or load_learning_bank()
        store = self.store or LearningDeliveryStore(s.greenpeak_learning_db_path)
        row, state = store.claim(date, str(s.telegram_chat_id), s.telegram_learning_message_thread_id,
                                 now.timestamp(), bank, s.auth_public_url)
        if row is None:
            return {"status": state, "claimed": False}
        try:
            result = self.sender(row["message_text"], row["topic_id"], settings=s,
                                 require_topic=True, reply_markup=json.loads(row["reply_markup"]))
            if result.status == "sent" and (type(result.message_id) is not int or result.message_id <= 0):
                result = TelegramDeliveryResult("uncertain", "learning_receipt_missing")
        except Exception:
            # Exceptions may contain bot credentials or request bodies.
            result = TelegramDeliveryResult("uncertain", "learning_delivery_outcome_unknown")
        state = store.finish(row, result, self.clock().timestamp())
        return {"status": state, "item_id": row["item_id"], "content_version": row["content_version"],
                "local_date": row["local_date"], "message_id": result.message_id,
                "error_code": result.error_code}


def process_daily_learning():
    try:
        result = LearningDailyWorker().process()
        if result.get("error_code"):
            logger.warning("Learning delivery: %s", result["error_code"])
        return result
    except (OSError, sqlite3.Error, ValueError, KeyError, TypeError):
        logger.error("Learning content or delivery storage unavailable")
        return {"status": "blocked", "error_code": "learning_storage_or_content_invalid"}


def create_learning_daily_scheduler():
    s = get_settings()
    if not s.greenpeak_learning_enabled:
        return None
    scheduler = BackgroundScheduler(timezone=TEHRAN, daemon=True)
    scheduler.add_job(process_daily_learning, "cron", hour=s.greenpeak_learning_hour,
                      minute=s.greenpeak_learning_minute, timezone=TEHRAN,
                      id="greenpeak-learning-daily", coalesce=True, max_instances=1,
                      misfire_grace_time=60, replace_existing=True)
    # Also handles startup catch-up and known pre-delivery failures, on this day only.
    scheduler.add_job(process_daily_learning, "interval", seconds=60,
                      id="greenpeak-learning-retry", coalesce=True, max_instances=1,
                      next_run_time=datetime.now(UTC), replace_existing=True)
    return scheduler


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("preview", "status", "tick"))
    parser.add_argument("--sequence", type=int, default=1)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    settings = get_settings()
    if args.command == "preview":
        bank = load_learning_bank()
        if not 1 <= args.sequence <= len(bank["items"]):
            parser.error("sequence outside content bank")
        item = bank["items"][args.sequence - 1]
        result = {"dry_run": True, "item_id": item["id"],
                  "topic_id": settings.telegram_learning_message_thread_id,
                  **learning_message(bank, item, settings.auth_public_url)}
    elif args.command == "status":
        # Read-only command: do not initialize or create a delivery ledger.
        path = settings.greenpeak_learning_db_path
        if not path.is_file():
            result = {"enabled": settings.greenpeak_learning_enabled, "deliveries": []}
        else:
            with closing(sqlite3.connect(path.resolve().as_uri() + "?mode=ro", uri=True)) as db:
                db.row_factory = sqlite3.Row
                rows = db.execute("SELECT local_date,item_id,content_version,status,attempts,message_id,error_code FROM learning_deliveries ORDER BY created_at DESC LIMIT 30")
                result = {"enabled": settings.greenpeak_learning_enabled, "deliveries": [dict(row) for row in rows]}
    else:
        result = process_daily_learning()
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    else:
        print(json.dumps(result, ensure_ascii=True, indent=2))


if __name__ == "__main__":
    main()
