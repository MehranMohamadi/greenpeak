"""Evidence used by the horizon-based persisted market narrative."""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from math import isfinite
from typing import Any
from zoneinfo import ZoneInfo

import httpx

from .economic_calendar import fetch_recent_us_events, fetch_upcoming_us_events
from .news.article_analysis import NEWS_ANALYSIS_VERSION
from .news.feed import build_source_feed
from .news.repository import MongoNewsRepository


YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC"
NEW_YORK = ZoneInfo("America/New_York")
TEHRAN = ZoneInfo("Asia/Tehran")


def _number(value: Any) -> float | None:
    try:
        parsed = float(value)
        return parsed if isfinite(parsed) else None
    except (TypeError, ValueError):
        return None


def parse_sp500_session_move(payload: dict[str, Any], now: datetime) -> dict[str, Any]:
    """Preserve the session benchmark and expose current/completed observations."""
    chart = payload.get("chart") if isinstance(payload, dict) else None
    results = chart.get("result") if isinstance(chart, dict) else None
    if not results or chart.get("error"):
        raise ValueError("S&P 500 chart result is unavailable")

    result = results[0]
    timestamps = result.get("timestamp") or []
    quotes = (result.get("indicators") or {}).get("quote") or []
    quote = quotes[0] if quotes else {}
    closes = quote.get("close") or []
    opens = quote.get("open") or []
    sessions: dict[str, dict[str, Any]] = {}

    for timestamp, open_value, close_value in zip(timestamps, opens, closes):
        opening, closing = _number(open_value), _number(close_value)
        if opening is None or closing is None:
            continue
        observed_at = datetime.fromtimestamp(int(timestamp), UTC).astimezone(NEW_YORK)
        if observed_at > now:
            continue
        day = observed_at.date().isoformat()
        session = sessions.setdefault(
            day,
            {"session_date": day, "open": opening, "close": closing, "last_observed_at": observed_at},
        )
        session["close"] = closing
        session["last_observed_at"] = observed_at

    ordered = [sessions[key] for key in sorted(sessions)]
    if len(ordered) < 2:
        raise ValueError("Insufficient S&P 500 sessions")

    local_now = now.astimezone(NEW_YORK)
    today = local_now.date().isoformat()
    today_index = next((index for index, item in enumerate(ordered) if item["session_date"] == today), None)
    use_today = today_index is not None and local_now.hour >= 15
    selected_index = today_index if use_today else len(ordered) - 1
    if not use_today and ordered[selected_index]["session_date"] == today:
        selected_index -= 1
    if selected_index < 1:
        raise ValueError("Previous S&P 500 close is unavailable")

    move = _session_move(ordered, selected_index)
    move["session_scope"] = "today_late_or_closed" if use_today else "previous_completed_session"

    # Use the same Yahoo response; no additional quote API is needed. Before
    # 15:00 the legacy benchmark stays on the prior close, but flow analysis
    # can now see today's observed move as well.
    move["current_session"] = _session_move(ordered, today_index) if today_index is not None and today_index >= 1 else None
    completed_index = len(ordered) - 1
    if ordered[completed_index]["session_date"] == today and local_now.hour < 16:
        completed_index -= 1
    move["latest_completed_session"] = _session_move(ordered, completed_index) if completed_index >= 1 else None
    if move["current_session"]:
        move["current_session"]["session_status"] = "completed" if local_now.hour >= 16 else "in_progress"
    if move["latest_completed_session"]:
        move["latest_completed_session"]["session_status"] = "completed"
    return move


def _session_move(ordered: list[dict[str, Any]], index: int) -> dict[str, Any]:
    selected, previous = ordered[index], ordered[index - 1]
    change = selected["close"] - previous["close"]
    change_pct = change / previous["close"] * 100 if previous["close"] else None
    direction = "up" if change > 0 else "down" if change < 0 else "flat"
    return {
        "symbol": "^GSPC",
        "session_date": selected["session_date"],
        "previous_session_date": previous["session_date"],
        "open": round(float(selected["open"]), 4),
        "close_or_latest": round(float(selected["close"]), 4),
        "previous_close": round(float(previous["close"]), 4),
        "change_points": round(float(change), 4),
        "change_pct": round(float(change_pct), 4) if change_pct is not None else None,
        "direction": direction,
        "last_observed_at": selected["last_observed_at"].isoformat(),
        "source": "Yahoo Finance chart API",
        "source_url": "https://finance.yahoo.com/quote/%5EGSPC/",
    }


def fetch_sp500_session_move(now: datetime, timeout: float = 12) -> dict[str, Any]:
    response = httpx.get(
        YAHOO_CHART_URL,
        params={"range": "5d", "interval": "5m", "includePrePost": "false", "events": "div,splits"},
        headers={"Accept": "application/json", "User-Agent": "GreenPeak/1.0 market-analysis"},
        timeout=timeout,
        follow_redirects=True,
    )
    response.raise_for_status()
    return parse_sp500_session_move(response.json(), now)


def _recent_news(client, database: str, now: datetime) -> list[dict[str, Any]]:
    repository = MongoNewsRepository(client, database)
    documents = repository.source_raw("alpha_vantage", now - timedelta(days=7), limit=100)
    feed = build_source_feed("alpha_vantage", documents, limit=12)
    item_ids = [item["item_id"] for item in feed["items"] if item.get("item_id")]
    analyses = {
        item["item_id"]: item
        for item in repository.article_analyses(item_ids, NEWS_ANALYSIS_VERSION)
        if item.get("item_id")
    }
    return [
        {
            "item_id": item.get("item_id"),
            "title": item.get("title"),
            "title_fa": analyses.get(item.get("item_id"), {}).get("title_fa") or item.get("title_fa"),
            "summary": item.get("summary"),
            "published_at": item.get("published_at"),
            "topics": item.get("topics") or [],
            "tickers": item.get("tickers") or [],
            "source_relevance_score": item.get("source_score"),
            "source_sentiment_score": item.get("alpha_sentiment_score"),
            "source_sentiment_label": item.get("alpha_sentiment_label"),
            "interpretation_fa": analyses.get(item.get("item_id"), {}).get("interpretation_fa"),
            "source_url": item.get("url"),
        }
        for item in feed["items"]
    ]


def build_market_analysis_context(
    client,
    database: str,
    as_of: date,
    now: datetime | None = None,
) -> dict[str, Any]:
    """Collect bounded, sanitized horizontal evidence without failing the main pipeline."""
    current = (now or datetime.now(UTC)).astimezone(UTC)
    context: dict[str, Any] = {
        "generated_at": current.isoformat(),
        "sp500_session_move": None,
        "recent_market_news": [],
        "upcoming_us_events": [],
        "current_market_context": {"released_us_events": [], "warnings": []},
        "warnings": [],
    }
    if as_of != current.astimezone(TEHRAN).date():
        context["warnings"].append("horizontal_evidence_skipped_for_historical_as_of")
        return context

    try:
        context["sp500_session_move"] = fetch_sp500_session_move(current)
    except (httpx.HTTPError, TypeError, ValueError):
        context["warnings"].append("sp500_session_move_unavailable")

    try:
        context["recent_market_news"] = _recent_news(client, database, current)
        if not context["recent_market_news"]:
            context["warnings"].append("recent_market_news_unavailable")
    except Exception:
        context["warnings"].append("recent_market_news_unavailable")

    try:
        context["upcoming_us_events"] = fetch_upcoming_us_events(now=current, days=21, limit=12)
        if not context["upcoming_us_events"]:
            context["warnings"].append("upcoming_us_events_unavailable")
    except (httpx.HTTPError, TypeError, ValueError):
        context["warnings"].append("upcoming_us_events_unavailable")

    # Reuse the same calendar service as the existing published-data table.
    # This extra evidence is for the current-market-flow prompt only.
    flow_context = context["current_market_context"]
    try:
        flow_context["released_us_events"] = fetch_recent_us_events(now=current, days=7, limit=12)
        if not flow_context["released_us_events"]:
            flow_context["warnings"].append("released_us_events_unavailable")
    except (httpx.HTTPError, TypeError, ValueError):
        flow_context["warnings"].append("released_us_events_unavailable")
    return context
