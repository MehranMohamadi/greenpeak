import html
import logging
from typing import Any

import httpx

from ..core.config import get_settings
from ..services.greenpeak_config import load_registry
from ..services.llm_engine.repository import MongoNarrativeRepository

logger = logging.getLogger(__name__)


def _format_driver(driver: Any) -> str:
    if isinstance(driver, dict):
        label = driver.get("label_fa") or driver.get("label") or driver.get("name")
        value = driver.get("value_fa") or driver.get("value") or driver.get("description_fa")
        if label and value:
            return f"{label}: {value}"
        return ", ".join(f"{key}: {value}" for key, value in driver.items())
    return str(driver)


def build_telegram_market_report(client, database: str) -> dict | None:
    repository = MongoNarrativeRepository(client, database)
    market = repository.latest("market", "sp500")
    if not market:
        return None
    domains = []
    for domain in load_registry()[0].domains:
        analysis = repository.latest("domain", domain.id)
        if analysis:
            domains.append({"name_fa": domain.name_fa, "analysis": analysis})
    return {"market": market, "domains": domains}


def _format_items(items: list[Any]) -> str:
    return "\n".join(f"• {html.escape(_format_driver(item))}" for item in items) or "• موردی ثبت نشده است"


def _report_sections(report: dict) -> list[str]:
    market = report.get("market", report)
    sections = [
        "<b>گزارش کامل تحلیل بازار GreenPeak</b>",
        f"<b>تاریخ داده:</b> {html.escape(str(market.get('data_as_of') or 'نامشخص'))}",
        f"<b>امتیاز سایه مدل:</b> {html.escape(str(market.get('llm_shadow_score') if market.get('llm_shadow_score') is not None else 'نامشخص'))}/10",
        f"<b>داستان بازار</b>\n{html.escape(str(market.get('market_story_fa') or ''))}",
        f"<b>روایت</b>\n{html.escape(str(market.get('narrative_fa') or ''))}",
        f"<b>محرک‌های مثبت</b>\n{_format_items(market.get('positive_drivers') or [])}",
        f"<b>محرک‌های منفی</b>\n{_format_items(market.get('negative_drivers') or [])}",
        f"<b>تعارض‌های بین‌دامنه‌ای</b>\n{_format_items(market.get('cross_domain_conflicts') or [])}",
        f"<b>ریسک‌ها و عدم قطعیت</b>\n{_format_items(market.get('key_risks') or [])}",
        f"<b>چه چیزی تغییر کرد</b>\n{html.escape(str(market.get('what_changed_fa') or ''))}",
        f"<b>موارد قابل پیگیری</b>\n{_format_items(market.get('watch_next_fa') or [])}",
    ]
    for item in report.get("domains", []):
        analysis = item["analysis"]
        sections.append(
            f"<b>دامنه: {html.escape(item['name_fa'])}</b>\n"
            f"{html.escape(str(analysis.get('dominant_story_fa') or analysis.get('narrative_fa') or ''))}\n"
            f"امتیاز LLM: {html.escape(str(analysis.get('llm_shadow_score', 'نامشخص')))}\n"
            f"<b>بینش‌ها</b>\n{_format_items(analysis.get('key_insights_fa') or [])}\n"
            f"<b>موارد قابل پیگیری</b>\n{_format_items(analysis.get('watch_next_fa') or [])}"
        )
    return sections


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
    if not token or not chat_id:
        logger.warning("Telegram notification is disabled: credentials are not configured")
        return False

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    try:
        for message in _message_chunks(_report_sections(market_data)):
            response = httpx.post(url, data={"chat_id": chat_id, "text": message, "parse_mode": "HTML", "disable_web_page_preview": "true"}, timeout=15)
            response.raise_for_status()
            if not response.json().get("ok", False):
                logger.error("Telegram rejected the market report: %s", response.text)
                return False
    except httpx.HTTPError:
        logger.exception("Telegram market report could not be sent")
        return False
    return True