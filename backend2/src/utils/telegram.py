import html
import logging
from typing import Any

import httpx

from ..core.config import get_settings

logger = logging.getLogger(__name__)


def _format_driver(driver: Any) -> str:
    if isinstance(driver, dict):
        label = driver.get("label_fa") or driver.get("label") or driver.get("name")
        value = driver.get("value_fa") or driver.get("value") or driver.get("description_fa")
        if label and value:
            return f"{label}: {value}"
        return ", ".join(f"{key}: {value}" for key, value in driver.items())
    return str(driver)


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

    data_as_of = html.escape(str(market_data.get("data_as_of") or "نامشخص"))
    score_value = market_data.get("llm_shadow_score")
    score = html.escape(str(score_value if score_value is not None else "نامشخص"))
    story = html.escape(str(market_data.get("market_story_fa") or "روایتی ثبت نشده است"))
    drivers = market_data.get("positive_drivers") or []
    driver_lines = "\n".join(f"• {html.escape(_format_driver(driver))}" for driver in drivers)
    if not driver_lines:
        driver_lines = "• موردی ثبت نشده است"

    message = (
        "<b>گزارش تحلیل بازار S&amp;P 500</b>\n"
        f"<b>تاریخ داده:</b> {data_as_of}\n"
        f"<b>امتیاز سایه مدل:</b> {score}/10\n\n"
        f"<b>روایت بازار</b>\n{story}\n\n"
        f"<b>محرک‌های مثبت</b>\n{driver_lines}"
    )

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    try:
        response = httpx.post(
            url,
            data={
                "chat_id": chat_id,
                "text": message,
                "parse_mode": "HTML",
                "disable_web_page_preview": "true",
            },
            timeout=15,
        )
        response.raise_for_status()
        if not response.json().get("ok", False):
            logger.error("Telegram rejected the market report: %s", response.text)
            return False
    except httpx.HTTPError:
        logger.exception("Telegram market report could not be sent")
        return False
    return True