from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

import httpx

TRADAYS_CONTENT_URL = "https://www.tradays.com/en/economic-calendar/widget/content"
TRADAYS_BASE_URL = "https://www.tradays.com"

EVENT_TITLES_FA = {
    "adp-nonfarm-employment-change": "تغییر اشتغال بخش خصوصی ADP",
    "average-hourly-earnings-mm": "تغییر ماهانه متوسط دستمزد ساعتی",
    "average-hourly-earnings-yy": "تغییر سالانه متوسط دستمزد ساعتی",
    "cb-consumer-confidence": "شاخص اعتماد مصرف‌کننده کنفرانس بورد",
    "chicago-pmi": "شاخص فعالیت تجاری شیکاگو",
    "consumer-confidence-index": "شاخص اعتماد مصرف‌کننده کنفرانس بورد",
    "consumer-price-index-mm": "تورم مصرف‌کننده ماهانه",
    "consumer-price-index-yy": "تورم مصرف‌کننده سالانه",
    "core-consumer-price-index-mm": "تورم هسته مصرف‌کننده ماهانه",
    "core-consumer-price-index-yy": "تورم هسته مصرف‌کننده سالانه",
    "core-durable-goods-orders": "سفارش کالاهای بادوام بدون حمل‌ونقل",
    "core-pce-price-index-mm": "تورم هسته PCE ماهانه",
    "core-pce-price-index-yy": "تورم هسته PCE سالانه",
    "durable-goods-orders": "سفارش کالاهای بادوام ماهانه",
    "eia-crude-oil-stocks-change": "تغییر ذخایر نفت خام آمریکا",
    "fed-interest-rate-decision": "تصمیم نرخ بهره فدرال رزرو",
    "fed-press-conference": "نشست خبری فدرال رزرو",
    "gross-domestic-product-qq": "رشد فصلی تولید ناخالص داخلی آمریکا",
    "initial-jobless-claims": "درخواست‌های اولیه بیمه بیکاری",
    "ism-manufacturing-pmi": "شاخص مدیران خرید تولیدی ISM",
    "ism-manufacturing-prices-paid": "شاخص قیمت‌های پرداختی تولیدی ISM",
    "ism-non-manufacturing-pmi": "شاخص مدیران خرید خدمات ISM",
    "ism-non-manufacturing-prices": "شاخص قیمت‌های پرداختی خدمات ISM",
    "jolts-job-openings": "فرصت‌های شغلی JOLTS",
    "markit-manufacturing-pmi": "شاخص مدیران خرید تولیدی S&P Global",
    "markit-services-pmi": "شاخص مدیران خرید خدمات S&P Global",
    "new-home-sales": "فروش خانه‌های نوساز آمریکا",
    "nonfarm-payrolls": "اشتغال غیرکشاورزی آمریکا",
    "pce-price-index-mm": "تورم PCE ماهانه",
    "pce-price-index-yy": "تورم PCE سالانه",
    "producer-price-index-mm": "تورم تولیدکننده ماهانه",
    "producer-price-index-yy": "تورم تولیدکننده سالانه",
    "retail-sales-mm": "خرده‌فروشی ماهانه آمریکا",
    "unemployment-rate": "نرخ بیکاری آمریکا",
}


def _event_slug(value: Any) -> str:
    return str(value or "").rstrip("/").rsplit("/", 1)[-1]


def _title_fa(row: dict[str, Any]) -> str:
    return EVENT_TITLES_FA.get(_event_slug(row.get("Url")), "رویداد مهم اقتصادی آمریکا")


def _release_at(row: dict[str, Any]) -> datetime | None:
    try:
        return datetime.fromtimestamp(float(row["ReleaseDate"]) / 1000, tz=UTC)
    except (KeyError, TypeError, ValueError, OSError):
        return None


def fetch_upcoming_us_events(
    *,
    now: datetime | None = None,
    days: int = 14,
    limit: int = 6,
    timeout: float = 15,
) -> list[dict[str, Any]]:
    """Return high-importance upcoming U.S. events from the site's calendar source."""
    anchor = (now or datetime.now(UTC)).astimezone(UTC)
    start = anchor.replace(hour=0, minute=0, second=0, microsecond=0)
    end = anchor + timedelta(days=days)
    response = httpx.get(
        TRADAYS_CONTENT_URL,
        params={
            "date_mode": 0,
            "from": start.strftime("%Y-%m-%dT%H:%M:%S"),
            "to": end.strftime("%Y-%m-%dT%H:%M:%S"),
            "importance": 8,
            "currencies": 1,
        },
        headers={
            "User-Agent": "GreenPeak-Calendar/1.0",
            "X-Requested-With": "XMLHttpRequest",
        },
        timeout=timeout,
        follow_redirects=True,
    )
    response.raise_for_status()
    payload = response.json()
    if not isinstance(payload, list):
        raise ValueError("Unexpected calendar response")

    events = []
    for row in payload:
        if not isinstance(row, dict):
            continue
        release_at = _release_at(row)
        if (
            release_at is None
            or release_at < anchor
            or row.get("Importance") != "high"
            or row.get("CurrencyCode") != "USD"
            or row.get("Country") != 840
        ):
            continue
        source_path = str(row.get("Url") or "")
        events.append(
            {
                "event_id": str(row.get("Id") or f"{_event_slug(source_path)}-{int(release_at.timestamp())}"),
                "title_fa": _title_fa(row),
                "release_at": release_at.isoformat(),
                "importance": "high",
                "forecast": row.get("ForecastValue") or None,
                "previous": row.get("PreviousValue") or None,
                "source": "Tradays / MQL5",
                "source_url": f"{TRADAYS_BASE_URL}{source_path}" if source_path.startswith("/") else TRADAYS_BASE_URL,
            }
        )

    events.sort(key=lambda item: item["release_at"])
    return events[:limit]
