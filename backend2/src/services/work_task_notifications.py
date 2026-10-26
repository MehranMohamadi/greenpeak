"""Atomic per-event Telegram outbox for internal, team-visible work only."""

import html
import logging
import re
from datetime import datetime, timedelta, timezone
from urllib.parse import quote, urlsplit
from uuid import uuid4

from apscheduler.schedulers.background import BackgroundScheduler

from ..core.config import get_settings
from ..utils.telegram import TelegramDeliveryResult, send_telegram_message
from ..utils.persian_date import format_persian_date

logger = logging.getLogger(__name__)
MAX_ATTEMPTS = 8
CLAIM_LIFETIME = timedelta(minutes=5)
READY = {"pending", "retry", "blocked"}
HEADINGS = {"created": "کار جدید", "updated": "واگذاری کار به مسئول جدید",
            "submitted": "منتظر تأیید", "changes_requested": "نیازمند اصلاح",
            "approved": "تأیید شد", "completed_without_approval": "کار تکمیل شد؛ بدون نیاز به تأیید"}


def configuration_error(settings):
    thread = settings.telegram_task_message_thread_id
    if not isinstance(thread, int) or isinstance(thread, bool) or thread <= 1:
        return "task_topic_not_configured"
    if not settings.telegram_bot_token or not settings.telegram_chat_id:
        return "telegram_not_configured"
    try:
        url = urlsplit(settings.auth_public_url)
        if (url.scheme not in {"http", "https"} or not url.hostname or url.username or url.password
                or url.query or url.fragment or len(settings.auth_public_url) > 300):
            return "task_public_url_invalid"
        if settings.environment == "production" and url.hostname in {"localhost", "127.0.0.1", "::1"}:
            return "task_public_url_not_configured"
    except ValueError:
        return "task_public_url_invalid"
    return None


def delivery_for_event(task, kind, details):
    """Called before the atomic task write. Never contacts an external service."""
    if task["visibility"] != "team" or kind not in HEADINGS:
        return None
    if kind == "updated":
        before, after = details.get("before", {}).get("assignee_id"), details.get("after", {}).get("assignee_id")
        if not before or not after or before["id"] == after["id"]:
            return None
    if kind == "submitted" and not task["requires_approval"]:
        return None  # The accompanying completion event is the only notification.
    note = details.get("reason") if kind in {"changes_requested", "approved"} else details.get("note")
    if kind == "created":
        note = task["description"]
    if kind == "completed_without_approval" and task["submissions"]:
        note = task["submissions"][-1]["note"]
    error = configuration_error(get_settings())
    return {"status": "blocked" if error else "pending", "error_code": error,
            "context": {"title": task["title"], "assignee": dict(task["assignee"]),
                        "created_by": dict(task["created_by"]), "due_date": task["due_date"], "note": note or ""}}


def _short(value, limit):
    value = " ".join(re.sub(r"[\x00-\x1f\u202a-\u202e\u2066-\u2069]", " ", str(value or "")).split())
    return value if len(value) <= limit else value[:limit - 1] + "…"


def format_due_date(value):
    """Match the site's Persian, zero-padded numeric deadline display."""
    return format_persian_date(value)


def task_message(task, event, settings):
    context = event["telegram"]["context"]
    escape = lambda value, limit: html.escape(_short(value, limit))
    lines = [f"<b>{HEADINGS[event['kind']]}</b>", f"کار: {escape(context['title'], 160)}",
             f"مسئول انجام: {escape(context['assignee']['username'], 48)}",
             f"ایجادکننده: {escape(context['created_by']['username'], 48)}",
             f"اقدام‌کننده: {escape(event['actor']['username'], 48)}"]
    if context.get("due_date"):
        lines.append(f"مهلت: {format_due_date(context['due_date'])}")
    if context.get("note"):
        label = "دلیل اصلاح" if event["kind"] == "changes_requested" else "توضیح نتیجه" if event["kind"] in {"submitted", "completed_without_approval"} else "توضیح"
        lines.append(f"{label}: {escape(context['note'], 200)}")
    link = settings.auth_public_url.rstrip("/") + "/workplace?task=" + quote(task["id"], safe="")
    lines.append(f'<a href="{html.escape(link, quote=True)}">مشاهده جزئیات کار در سایت</a>')
    return "\n".join(lines)


class _NotClaimed(Exception):
    pass


def _instant(value):
    return datetime.fromisoformat(str(value).replace("Z", "+00:00"))


class WorkTaskNotificationWorker:
    def __init__(self, repository, settings=None, clock=None, sender=None):
        self.repository = repository
        self.settings = settings or get_settings()
        self.clock = clock or (lambda: datetime.now(timezone.utc))
        self.sender = sender or send_telegram_message

    def _claim(self, task_id, event_id, now):
        claim_id = str(uuid4())
        def change(task):
            event = next((item for item in task["events"] if item["id"] == event_id), None)
            delivery = event.get("telegram") if event else None
            if not delivery or delivery["status"] not in READY | {"sending"}:
                raise _NotClaimed
            if delivery["status"] == "sending":
                if _instant(delivery["claimed_at"]) > now - CLAIM_LIFETIME:
                    raise _NotClaimed
                delivery.update(status="uncertain", error_code="delivery_interrupted_outcome_unknown")
            elif task["visibility"] != "team":
                delivery.update(status="skipped", error_code="task_not_team_visible")
            elif delivery.get("next_attempt_at") and _instant(delivery["next_attempt_at"]) > now:
                raise _NotClaimed
            elif configuration_error(self.settings):
                delivery.update(status="blocked", error_code=configuration_error(self.settings),
                                next_attempt_at=(now + timedelta(minutes=5)).isoformat())
            elif delivery.get("attempts", 0) >= MAX_ATTEMPTS:
                delivery.update(status="failed", error_code="telegram_attempts_exhausted")
            else:
                delivery.update(status="sending", claim_id=claim_id, claimed_at=now.isoformat(),
                                attempts=delivery.get("attempts", 0) + 1, next_attempt_at=None, error_code=None)
            return task
        try:
            changed = self.repository.mutate(task_id, change)
        except _NotClaimed:
            return None
        delivery = next(item for item in changed["events"] if item["id"] == event_id)["telegram"]
        if delivery["status"] != "sending" or delivery["claim_id"] != claim_id:
            if delivery.get("error_code"):
                logger.warning("Work Telegram event %s: %s", event_id, delivery["error_code"])
            return None
        return claim_id

    def _finish(self, task_id, event_id, claim_id, result, now):
        def change(task):
            delivery = next(item for item in task["events"] if item["id"] == event_id)["telegram"]
            if delivery["status"] != "sending" or delivery["claim_id"] != claim_id:
                raise _NotClaimed
            status = result.status
            if status == "retry" and delivery["attempts"] >= MAX_ATTEMPTS:
                status = "failed"
            wait = max(result.retry_after or 0, min(3600, 30 * 2 ** (delivery["attempts"] - 1)))
            delivery.update(status=status, error_code=result.error_code, message_id=result.message_id,
                            sent_at=now.isoformat() if status == "sent" else None,
                            next_attempt_at=(now + timedelta(seconds=max(300 if status == "blocked" else 0, wait))).isoformat()
                            if status in {"retry", "blocked"} else None)
            return task
        self.repository.mutate(task_id, change)
        if result.error_code:
            logger.warning("Work Telegram event %s: %s", event_id, result.error_code)

    def process(self, limit=30):
        processed = 0
        for snapshot in self.repository.all():
            for queued in snapshot["events"]:
                delivery = queued.get("telegram")
                if not delivery or delivery["status"] not in READY | {"sending"}:
                    continue
                if processed >= limit:
                    return processed
                now = self.clock()
                if delivery.get("next_attempt_at") and _instant(delivery["next_attempt_at"]) > now:
                    break  # Keep a work's notifications ordered.
                claim = self._claim(snapshot["id"], queued["id"], now)
                if not claim:
                    current = self.repository.get(snapshot["id"])
                    state = next(item for item in current["events"] if item["id"] == queued["id"])["telegram"]["status"]
                    if state in READY | {"sending"}:
                        break
                    continue
                processed += 1
                # Re-read at the last possible point, including for every retry.
                current = self.repository.get(snapshot["id"])
                event = next(item for item in current["events"] if item["id"] == queued["id"])
                if current["visibility"] != "team":
                    result = TelegramDeliveryResult("skipped", "task_not_team_visible")
                else:
                    try:
                        result = self.sender(task_message(current, event, self.settings),
                                             self.settings.telegram_task_message_thread_id,
                                             settings=self.settings, require_topic=True)
                    except Exception:
                        result = TelegramDeliveryResult("uncertain", "telegram_delivery_outcome_unknown")
                self._finish(current["id"], event["id"], claim, result, self.clock())
                if result.status in {"retry", "blocked"}:
                    break
        return processed


def process_work_task_notifications():
    # Lazy import avoids an API/service import cycle and uses the same auth store.
    from ..api.v1.endpoints.auth import get_auth_service
    from ..api.v1.endpoints.work_tasks import tasks_repository
    try:
        WorkTaskNotificationWorker(tasks_repository(get_auth_service())).process()
    except Exception:
        # No database connection strings, bot URLs, user content or tracebacks.
        logger.error("Work Telegram worker failed: notification_storage_unavailable")


def create_work_task_notification_scheduler():
    error = configuration_error(get_settings())
    if error:
        logger.warning("Work Telegram scheduler disabled: %s", error)
        return None
    scheduler = BackgroundScheduler(timezone="UTC", daemon=True)
    scheduler.add_job(process_work_task_notifications, "interval", seconds=15,
                      id="greenpeak-work-task-telegram", coalesce=True, max_instances=1, replace_existing=True)
    return scheduler
