import html
import logging
import re
from dataclasses import dataclass

import httpx

from ..core.config import get_settings
from ..services.llm_engine.repository import MongoNarrativeRepository

logger = logging.getLogger(__name__)


class _RedactBotURL(logging.Filter):
    def filter(self, record):
        message = record.getMessage()
        if "api.telegram.org/bot" in message:
            record.msg = re.sub(r"api\.telegram\.org/bot[^\s/]+", "api.telegram.org/bot[redacted]", message)
            record.args = ()
        return True


# HTTPX logs the request URL at INFO; a Bot API URL contains the credential.
logging.getLogger("httpx").addFilter(_RedactBotURL())


@dataclass(frozen=True)
class TelegramDeliveryResult:
    status: str
    error_code: str | None = None
    message_id: int | None = None
    retry_after: int | None = None


def send_telegram_message(text, message_thread_id, *, settings=None, require_topic=False):
    """Shared bot/recipient transport; never log response bodies, URLs or exceptions.

    Only failures known to precede delivery are retryable. A lost response may
    already represent a delivered message; Telegram sendMessage has no request
    idempotency key, so callers must retain uncertain outcomes for inspection.
    """
    settings = settings or get_settings()
    if require_topic and (not isinstance(message_thread_id, int) or isinstance(message_thread_id, bool) or message_thread_id <= 1):
        return TelegramDeliveryResult("blocked", "task_topic_not_configured")
    if not settings.telegram_bot_token or not settings.telegram_chat_id:
        return TelegramDeliveryResult("blocked", "telegram_not_configured")
    payload = {"chat_id": settings.telegram_chat_id, "text": text, "parse_mode": "HTML",
               "disable_web_page_preview": "true"}
    if message_thread_id is not None:
        payload["message_thread_id"] = str(message_thread_id)
    try:
        response = httpx.post(f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage",
                              data=payload, timeout=15)
        body = response.json()
        if getattr(response, "status_code", 200) >= 500:
            return TelegramDeliveryResult("uncertain", "telegram_server_outcome_unknown")
        if not body.get("ok"):
            if body.get("error_code") == 429:
                wait = body.get("parameters", {}).get("retry_after", 60)
                return TelegramDeliveryResult("retry", "telegram_rate_limited", retry_after=max(1, int(wait)))
            description = str(body.get("description", "")).lower()
            code = "telegram_rejected"
            if "thread" in description or "topic" in description:
                code = "telegram_topic_unavailable"
            elif body.get("error_code") == 403:
                code = "telegram_permission_denied"
            elif body.get("error_code") == 401:
                code = "telegram_bot_unauthorized"
            return TelegramDeliveryResult("blocked", code)
        result = body.get("result") or {}
        if require_topic and (result.get("message_thread_id") != message_thread_id or not isinstance(result.get("message_id"), int)):
            return TelegramDeliveryResult("uncertain", "telegram_topic_receipt_mismatch")
        return TelegramDeliveryResult("sent", message_id=result.get("message_id"))
    except (httpx.ConnectError, httpx.ConnectTimeout, httpx.PoolTimeout):
        return TelegramDeliveryResult("retry", "telegram_connection_failed")
    except (httpx.HTTPError, ValueError, TypeError, AttributeError):
        return TelegramDeliveryResult("uncertain", "telegram_delivery_outcome_unknown")


def build_telegram_market_report(client, database: str) -> dict | None:
    repository = MongoNarrativeRepository(client, database)
    market = repository.latest("market", "sp500")
    if not market:
        return None
    return {"market": market}


def _report_sections(report: dict) -> list[str]:
    market = report.get("market", report)
    current_move = market.get("current_market_move_fa") or market.get("what_changed_fa") or market.get("market_story_fa") or ""
    current_analysis = market.get("current_analysis_fa") or market.get("systemic_synthesis_fa") or market.get("narrative_fa") or ""
    current_content = "\n\n".join(
        html.escape(str(value)) for value in (current_move, current_analysis) if value
    )

    summary_points = market.get("summary_points_fa") or [market.get("market_story_fa")]
    summary_content = "\n".join(
        f"{index}. {html.escape(str(item))}"
        for index, item in enumerate(summary_points[:5], start=1)
        if item
    )

    return [
        f"<b>اکنون</b>\n{current_content}",
        f"<b>جمع‌بندی</b>\n{summary_content}",
    ]


def _split_oversized_section(section: str, limit: int) -> list[str]:
    """Split escaped HTML text on whitespace without cutting common entities."""
    if len(section) <= limit:
        return [section]
    chunks: list[str] = []
    current = ""
    for line in section.splitlines():
        words = line.split()
        if not words:
            if current and len(current) + 1 <= limit:
                current += "\n"
            continue
        for word in words:
            separator = "" if not current else " "
            if current and len(current) + len(separator) + len(word) > limit:
                chunks.append(current.rstrip())
                current = word
            else:
                current = f"{current}{separator}{word}"
        if current and len(current) + 1 <= limit:
            current += "\n"
    if current.strip():
        chunks.append(current.rstrip())
    return chunks


def _message_chunks(sections: list[str], limit: int = 3900) -> list[str]:
    chunks: list[str] = []
    current = ""
    safe_sections = [part for section in sections for part in _split_oversized_section(section, limit)]
    for section in safe_sections:
        candidate = f"{current}\n\n{section}" if current else section
        if current and len(candidate) > limit:
            chunks.append(current)
            current = section
        else:
            current = candidate
    if current:
        chunks.append(current)
    return chunks


def send_telegram_market_report(market_data: dict) -> bool:
    """Send the persisted market narrative to Telegram.

    Missing Telegram configuration is treated as a disabled notification. The
    function returns False for configuration or Telegram API failures so a
    notification problem cannot change the analysis result.
    """
    settings = get_settings()
    for message in _message_chunks(_report_sections(market_data)):
        result = send_telegram_message(message, settings.telegram_message_thread_id, settings=settings)
        if result.status != "sent":
            logger.warning("Telegram market report failed: %s", result.error_code)
            return False
    return True
