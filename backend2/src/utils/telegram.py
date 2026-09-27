import html
import logging

import httpx

from ..core.config import get_settings
from ..services.llm_engine.repository import MongoNarrativeRepository

logger = logging.getLogger(__name__)


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


def _message_chunks(sections: list[str], limit: int = 3900) -> list[str]:
    chunks: list[str] = []
    current = ""
    for section in sections:
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
    token = settings.telegram_bot_token
    chat_id = settings.telegram_chat_id
    message_thread_id = settings.telegram_message_thread_id
    if not token or not chat_id:
        logger.warning("Telegram notification is disabled: credentials are not configured")
        return False

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    try:
        for message in _message_chunks(_report_sections(market_data)):
            payload = {
                "chat_id": chat_id,
                "text": message,
                "parse_mode": "HTML",
                "disable_web_page_preview": "true",
            }
            if message_thread_id is not None:
                payload["message_thread_id"] = str(message_thread_id)
            response = httpx.post(url, data=payload, timeout=15)
            response.raise_for_status()
            if not response.json().get("ok", False):
                logger.error("Telegram rejected the market report: %s", response.text)
                return False
    except httpx.HTTPError:
        logger.exception("Telegram market report could not be sent")
        return False
    return True
