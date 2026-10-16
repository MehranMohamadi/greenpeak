"""Read-only CNBC highlights, selected for US-market relevance and freshness."""

from __future__ import annotations

from copy import deepcopy
from datetime import UTC, datetime, timedelta
import hashlib
import re
from threading import Lock
from time import monotonic
from urllib.parse import urlsplit, urlunsplit
from xml.etree.ElementTree import ParseError

import httpx

from .feed import _plain_text, stable_item_id
from .schemas import CNBCNewsHighlight, CNBCNewsHighlights
from .sources import fetch_rss


# These are GreenPeak editorial rules, not scores supplied by CNBC and not
# estimates of price impact. Headline matches carry more weight than summaries.
SELECTION_VERSION = "greenpeak_us_market_relevance_v1"
TOPICS = (
    (5, "سیاست پولی", r"\bfederal reserve\b|\bfed\b|\bfomc\b|\binterest rates?\b|\brate (?:cuts?|hikes?|decision)\b"),
    (5, "تورم، اشتغال و رشد اقتصادی", r"\bcpi\b|\bpce\b|\binflation\b|\bpayrolls?\b|\bjobs report\b|\bgdp\b|\brecession\b|\bunemployment\b"),
    (4, "بازار سهام و اوراق آمریکا", r"\bs\s*&\s*p(?:\s*500)?\b|\bstock market\b|\bwall street\b|\bnasdaq\b|\bdow\b|\bstock futures\b|\bu\.?s\.? stocks\b|\btreasury yields?\b"),
    (4, "نتایج مالی شرکت‌ها", r"\bearnings\b|\brevenue\b|\bprofit forecast\b"),
    (3, "شرکت‌های بزرگ بازار آمریکا", r"\bapple\b|\bmicrosoft\b|\bnvidia\b|\balphabet\b|\bgoogle\b|\bamazon\b|\bmeta\b|\btesla\b"),
    (3, "سیاست تجاری و انرژی", r"\btariffs?\b|\btrade war\b|\bgovernment shutdown\b|\bdebt ceiling\b|\boil prices?\b|\bcrude\b"),
)
_TOPIC_PATTERNS = [(weight, label, re.compile(pattern, re.I)) for weight, label, pattern in TOPICS]
_cache_lock = Lock()
_rss_cache: dict[str, tuple[float, list[dict]]] = {}


class NewsHighlightsUnavailableError(Exception):
    pass


def _utc_date(value) -> datetime | None:
    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    if not isinstance(value, datetime):
        return None
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def _candidates(documents: list[dict], now: datetime) -> list[dict]:
    candidates = []
    for document in documents:
        if not isinstance(document, dict) or document.get("source") != "cnbc_rss":
            continue
        title = _plain_text(document["title"]) if isinstance(document.get("title"), str) else None
        published = _utc_date(document.get("published_at"))
        try:
            url = urlsplit(str(document.get("url") or ""))
            host = (url.hostname or "").lower()
            valid_url = url.scheme in {"https", "http"} and (host == "cnbc.com" or host.endswith(".cnbc.com")) and not url.username and not url.password
        except ValueError:
            continue
        if not title or not valid_url or published is None:
            continue
        if published < now - timedelta(days=7) or published > now + timedelta(minutes=5):
            continue
        canonical_url = urlunsplit((url.scheme, host, url.path, "", ""))
        item_id = document.get("item_id")
        if not isinstance(item_id, str) or not re.fullmatch(r"[a-zA-Z0-9_-]{1,80}", item_id):
            item_id = hashlib.sha256(f"cnbc_rss:{canonical_url}".encode()).hexdigest()[:24]
        summary = _plain_text(document["summary"]) if isinstance(document.get("summary"), str) else None
        matches = [(weight * (2 if pattern.search(title) else 1), label)
                   for weight, label, pattern in _TOPIC_PATTERNS
                   if pattern.search(title) or pattern.search(summary or "")]
        age_hours = max(0, (now - published).total_seconds() / 3600)
        priority = sum(weight for weight, _ in matches) * (0.5 ** (age_hours / 48))
        candidates.append({
            "item_id": item_id, "title": title, "summary": summary,
            "url": canonical_url, "published_at": published,
            "selection_reason_fa": "، ".join(label for _, label in matches[:2]) or "تازگی خبر در خوراک CNBC",
            "_priority": priority, "_title_key": re.sub(r"\W+", "", title.casefold()),
        })
    return candidates


def build_cnbc_highlights(documents: list[dict], *, now: datetime | None = None, data_origin: str = "database") -> CNBCNewsHighlights:
    now = now or datetime.now(UTC)
    candidates = _candidates(documents, now)
    # Rank recent coverage first; older stories only fill any remaining slots.
    candidates.sort(key=lambda item: (
        item["published_at"] < now - timedelta(hours=72),
        -item["_priority"], -item["published_at"].timestamp(), item["item_id"],
    ))
    selected = []
    seen_urls, seen_titles, seen_ids = set(), set(), set()
    for item in candidates:
        if item["url"] in seen_urls or item["_title_key"] in seen_titles or item["item_id"] in seen_ids:
            continue
        seen_urls.add(item["url"])
        seen_titles.add(item["_title_key"])
        seen_ids.add(item["item_id"])
        selected.append(CNBCNewsHighlight(
            **{key: value for key, value in item.items() if not key.startswith("_")},
            selection_rank=len(selected) + 1,
            analysis_available=data_origin == "database",
        ))
        if len(selected) == 4:
            break
    latest = max((item["published_at"] for item in candidates), default=None)
    return CNBCNewsHighlights(
        items=selected, count=len(selected), ranking=SELECTION_VERSION,
        data_origin=data_origin, latest_published_at=latest,
        stale=bool(latest and latest < now - timedelta(hours=48)),
    )


def _live_documents(feed_url: str) -> list[dict]:
    with _cache_lock:
        cached = _rss_cache.get(feed_url)
        if cached and cached[0] > monotonic():
            return deepcopy(cached[1])
        items = fetch_rss(feed_url, "cnbc_rss", timeout=15)
        documents = [{**item.model_dump(mode="python"), "url": str(item.url), "item_id": stable_item_id(item)} for item in items]
        _rss_cache[feed_url] = (monotonic() + 300, documents)
        return deepcopy(documents)


def get_cnbc_highlights(documents: list[dict], feed_url: str, *, now: datetime | None = None) -> CNBCNewsHighlights:
    now = now or datetime.now(UTC)
    stored = build_cnbc_highlights(documents, now=now)
    last_fetch = max((_utc_date(item.get("fetched_at")) or _utc_date(item.get("published_at")) or datetime.min.replace(tzinfo=UTC)
                      for item in documents if isinstance(item, dict)), default=datetime.min.replace(tzinfo=UTC))
    if stored.count == 4 and not stored.stale and last_fetch >= now - timedelta(minutes=30):
        return stored
    try:
        live = build_cnbc_highlights(_live_documents(feed_url), now=now, data_origin="rss")
        if live.count:
            return live
    except (httpx.HTTPError, ValueError, ParseError):
        pass
    if stored.count:
        return stored
    raise NewsHighlightsUnavailableError("CNBC highlights are temporarily unavailable")
