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


def _calendar_value(row: dict[str, Any], key: str) -> Any | None:
    value = row.get(key)
    return value if value not in {None, ""} else None


def _fetch_calendar_rows(start: datetime, end: datetime, timeout: float) -> list[dict[str, Any]]:
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
    return payload


def _calendar_event(row: dict[str, Any], release_at: datetime) -> dict[str, Any]:
    source_path = str(row.get("Url") or "")
    return {
        "event_id": str(row.get("Id") or f"{_event_slug(source_path)}-{int(release_at.timestamp())}"),
        "title_fa": _title_fa(row),
        "release_at": release_at.isoformat(),
        "importance": "high",
        "actual": _calendar_value(row, "ActualValue"),
        "forecast": _calendar_value(row, "ForecastValue"),
        "previous": _calendar_value(row, "PreviousValue"),
        "source": "Tradays / MQL5",
        "source_url": f"{TRADAYS_BASE_URL}{source_path}" if source_path.startswith("/") else TRADAYS_BASE_URL,
    }


def _is_high_importance_us_event(row: dict[str, Any]) -> bool:
    return (
        row.get("Importance") == "high"
        and row.get("CurrencyCode") == "USD"
        and row.get("Country") == 840
    )


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
    payload = _fetch_calendar_rows(start, end, timeout)

    events = []
    for row in payload:
        if not isinstance(row, dict):
            continue
        release_at = _release_at(row)
        if (
            release_at is None
            or release_at < anchor
            or not _is_high_importance_us_event(row)
        ):
            continue
        events.append(_calendar_event(row, release_at))

    events.sort(key=lambda item: item["release_at"])
    return events[:limit]


def fetch_recent_us_events(
    *,
    now: datetime | None = None,
    days: int = 14,
    limit: int = 6,
    timeout: float = 15,
) -> list[dict[str, Any]]:
    """Return recently released high-importance U.S. events with actual values."""
    anchor = (now or datetime.now(UTC)).astimezone(UTC)
    start = anchor - timedelta(days=days)
    payload = _fetch_calendar_rows(start, anchor, timeout)

    events = []
    for row in payload:
        if not isinstance(row, dict):
            continue
        release_at = _release_at(row)
        if (
            release_at is None
            or release_at > anchor
            or not _is_high_importance_us_event(row)
            or _calendar_value(row, "ActualValue") is None
        ):
            continue
        events.append(_calendar_event(row, release_at))

    events.sort(key=lambda item: item["release_at"], reverse=True)
    return events[:limit]
