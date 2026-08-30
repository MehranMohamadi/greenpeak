from __future__ import annotations

import html
import hashlib
import re
from datetime import datetime
from typing import Any

ALPHA_MEDIUM_RELEVANCE = 0.5
SEARCH_TOPICS = ("financial_markets", "economy_monetary", "economy_macro", "earnings")
SOURCE_IDS = ("alpha_vantage", "cnbc_rss", "investing_rss")


def stable_item_id(item) -> str:
    identity = item.source_item_id or str(item.canonical_url or item.url)
    return hashlib.sha256(f"{item.source}:{identity}".encode()).hexdigest()[:24]


def _published_key(value: Any) -> float:
    return value.timestamp() if isinstance(value, datetime) else 0.0


def _number(value: Any) -> float | None:
    try:
        number = float(value)
        return number if 0 <= number <= 1 else None
    except (TypeError, ValueError):
        return None


def alpha_source_score(document: dict) -> float | None:
    """Use relevance values supplied by Alpha Vantage; do not invent a score."""
    raw = document.get("raw_payload") or {}
    values = []
    for topic in raw.get("topics", []):
        values.append(_number(topic.get("relevance_score")))
    for ticker in raw.get("ticker_sentiment", []):
        values.append(_number(ticker.get("relevance_score") or ticker.get("ticker_relevance_score")))
    valid = [value for value in values if value is not None]
    return max(valid) if valid else None


def _plain_text(value: str | None) -> str | None:
    if not value: return None
    clean = re.sub(r"<[^>]+>", " ", html.unescape(value))
    return " ".join(clean.split()) or None


def build_source_feed(source: str, documents: list[dict], limit: int) -> dict:
    items = []
    for document in documents:
        score = alpha_source_score(document) if source == "alpha_vantage" else None
        published = document.get("published_at")
        items.append({
            "item_id": document.get("item_id"), "title": document.get("title"),
            "summary": _plain_text(document.get("summary")), "url": str(document.get("url")),
            "published_at": published, "topics": document.get("topics") or [],
            "tickers": document.get("tickers") or [], "source_score": score,
            "importance": "high" if score is not None and score >= .75 else "medium" if score is not None and score >= ALPHA_MEDIUM_RELEVANCE else None,
            "alpha_sentiment_score": document.get("alpha_overall_sentiment_score"),
            "alpha_sentiment_label": document.get("alpha_overall_sentiment_label"),
            "minimum_backfill": False,
        })
    if source == "alpha_vantage":
        items.sort(key=lambda x: (x["source_score"] is not None, x["source_score"] if x["source_score"] is not None else -1, _published_key(x["published_at"])), reverse=True)
        medium = [item for item in items if item["source_score"] is not None and item["source_score"] >= ALPHA_MEDIUM_RELEVANCE]
        selected = medium[:limit]
        if len(selected) < min(20, limit):
            selected_ids = {item["item_id"] for item in selected}
            for item in items:
                if item["item_id"] in selected_ids: continue
                item["minimum_backfill"] = True; selected.append(item)
                if len(selected) >= min(20, limit): break
    else:
        items.sort(key=lambda x: _published_key(x["published_at"]), reverse=True)
        selected = items[:limit]
    return {
        "source": source, "items": selected[:limit], "count": min(len(selected), limit),
        "available_count": len(items), "minimum_target": 20,
        "searched_topics": list(SEARCH_TOPICS) if source == "alpha_vantage" else [],
        "ranking": "alpha_vantage_relevance_score" if source == "alpha_vantage" else "published_at_desc",
        "native_importance_score_available": source == "alpha_vantage",
    }
