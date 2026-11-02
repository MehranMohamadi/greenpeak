"""Durable support inbox and independent email/Telegram notification deliveries."""

import json
import logging
import sqlite3
import time
from contextlib import closing, contextmanager
from html import escape
from uuid import uuid4

from apscheduler.schedulers.background import BackgroundScheduler

from ..core.config import get_settings
from ..utils.telegram import TelegramDeliveryResult, send_telegram_message
from .auth import AuthStorageError
from .auth_email import EmailSender

logger = logging.getLogger(__name__)


def telegram_parts(identifier, payload):
    labels = {"comment": "نظر", "suggestion": "پیشنهاد", "question": "سؤال", "bug": "گزارش مشکل"}
    header = (
        f"<b>پیام پشتیبانی GreenPeak</b>\nشناسه: {identifier}\n"
        f"موضوع: {labels[payload['category']]}\n"
        f"نام: {escape(payload['name'])}\nایمیل: {escape(payload['email'])}\n\n"
    )
    # Split raw text before escaping. Even emoji-only input stays under Telegram's
    # 4096-character limit in UTF-16, including the repeated sender metadata.
    return [header + escape(payload["message"][offset:offset + 1400])
            for offset in range(0, len(payload["message"]), 1400)]


class SupportNotifications:
    def __init__(self, settings=None, *, email_sender=None, telegram_sender=None, clock=None):
        self.settings = settings or get_settings()
        self.path = self.settings.support_db_path
        self.email_sender = email_sender or EmailSender(self.settings)
        self.telegram_sender = telegram_sender or send_telegram_message
        self.clock = clock or time.time

    @contextmanager
    def connect(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with closing(sqlite3.connect(self.path, timeout=15)) as db, db:
            self.path.chmod(0o600)
            db.row_factory = sqlite3.Row
            db.execute("""CREATE TABLE IF NOT EXISTS support_messages (
                id TEXT PRIMARY KEY, created_at REAL NOT NULL, payload TEXT NOT NULL)""")
            db.execute("""CREATE TABLE IF NOT EXISTS support_deliveries (
                message_id TEXT NOT NULL, channel TEXT NOT NULL, part INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
                available_at REAL NOT NULL DEFAULT 0, claimed_at REAL,
                error_code TEXT, PRIMARY KEY (message_id, channel, part))""")
            yield db

    def submit(self, payload):
        identifier = uuid4().hex
        try:
            with self.connect() as db:
                db.execute("INSERT INTO support_messages VALUES (?, ?, ?)",
                           (identifier, self.clock(), json.dumps(payload, ensure_ascii=False)))
                deliveries = [(identifier, "email", 0)] + [
                    (identifier, "telegram", part) for part in range(len(telegram_parts(identifier, payload)))
                ]
                db.executemany("INSERT INTO support_deliveries (message_id, channel, part) VALUES (?, ?, ?)",
                               deliveries)
        except (OSError, sqlite3.Error) as exc:
            raise AuthStorageError("Support storage is temporarily unavailable.") from exc
        return identifier

    def channel_configured(self, channel):
        s = self.settings
        if channel == "email":
            return bool(s.resend_api_key and s.auth_email_from
                        and (s.support_contact_email or s.support_copy_email))
        return bool(s.telegram_bot_token and s.telegram_chat_id and s.telegram_support_message_thread_id)

    def claim(self, identifier=None):
        now = self.clock()
        channels = [channel for channel in ("email", "telegram") if self.channel_configured(channel)]
        if not channels:
            return None
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            # A worker lost during delivery cannot prove whether Telegram sent it.
            # Resend is retryable with its original key, within its 24-hour window.
            db.execute("""UPDATE support_deliveries SET
                status = CASE channel WHEN 'email' THEN 'retry' ELSE 'uncertain' END,
                error_code = 'delivery_outcome_unknown'
                WHERE status = 'sending' AND claimed_at < ?""", (now - 300,))
            query = """SELECT d.*, m.payload, m.created_at FROM support_deliveries d
                JOIN support_messages m ON m.id = d.message_id
                WHERE d.status IN ('pending', 'retry') AND d.available_at <= ?
                AND d.channel IN (""" + ",".join("?" for _ in channels) + ")"
            params = [now, *channels]
            if identifier:
                query += " AND d.message_id = ?"
                params.append(identifier)
            query += " ORDER BY m.created_at, d.channel, d.part LIMIT 1"
            row = db.execute(query, params).fetchone()
            if row is None:
                return None
            row = dict(row)
            db.execute("""UPDATE support_deliveries SET status = 'sending',
                attempts = attempts + 1, claimed_at = ?
                WHERE message_id = ? AND channel = ? AND part = ?""",
                       (now, row["message_id"], row["channel"], row["part"]))
            row["attempts"] += 1
            row["claimed_at"] = now
            return row

    def deliver(self, row):
        payload = json.loads(row["payload"])
        if row["channel"] == "email":
            # Stop before Resend expires the idempotency key; never resend blindly.
            if row["attempts"] > 1 and self.clock() - row["created_at"] >= 23 * 3600:
                return TelegramDeliveryResult("uncertain", "email_idempotency_expired")
            try:
                self.email_sender.send_support_message(
                    **payload, idempotency_key=f"support-{row['message_id']}")
                return TelegramDeliveryResult("sent")
            except AuthStorageError:
                return TelegramDeliveryResult("retry", "support_email_unavailable")
        return self.telegram_sender(
            telegram_parts(row["message_id"], payload)[row["part"]],
            self.settings.telegram_support_message_thread_id,
            settings=self.settings, require_topic=True,
        )

    def process(self, identifier=None, limit=20):
        for _ in range(limit):
            row = self.claim(identifier)
            if row is None:
                break
            try:
                result = self.deliver(row)
            except Exception:
                # Provider exceptions may contain URLs, tokens or user content.
                result = TelegramDeliveryResult("uncertain", "support_delivery_outcome_unknown")
            state = result.status
            if state == "blocked":
                state = "retry"
            if state == "retry" and row["attempts"] >= 5:
                state = "failed"
            delay = max(30 * 2 ** (row["attempts"] - 1), result.retry_after or 0)
            with self.connect() as db:
                db.execute("""UPDATE support_deliveries SET status = ?, error_code = ?, available_at = ?
                    WHERE message_id = ? AND channel = ? AND part = ? AND status = 'sending'
                    AND claimed_at = ?""",
                           (state, result.error_code, self.clock() + delay,
                            row["message_id"], row["channel"], row["part"], row["claimed_at"]))
            if state != "sent":
                logger.warning("Support notification %s/%s: %s", row["message_id"], row["channel"], state)


def process_support_notifications(identifier=None):
    try:
        SupportNotifications().process(identifier)
    except (OSError, sqlite3.Error):
        logger.error("Support notification storage unavailable")


def create_support_notification_scheduler():
    scheduler = BackgroundScheduler(timezone="UTC", daemon=True)
    scheduler.add_job(process_support_notifications, "interval", seconds=15,
                      id="greenpeak-support-notifications", coalesce=True,
                      max_instances=1, replace_existing=True)
    return scheduler
