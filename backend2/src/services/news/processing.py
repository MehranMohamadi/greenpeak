from __future__ import annotations

import hashlib
import re
from collections import defaultdict
from datetime import UTC, datetime, timedelta
from difflib import SequenceMatcher
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from .schemas import RawNewsItem

TRACKING = {"fbclid", "gclid", "mc_cid", "mc_eid"}
BOILERPLATE = re.compile(r"\b(cnbc|investing\.com|breaking news|market update)\b", re.I)
SPONSORED = re.compile(r"\b(sponsored|advertorial|partner content|press release)\b", re.I)
TRADING = re.compile(r"\b(price target|buy signal|sell signal|technical analysis|day trad(?:e|ing))\b", re.I)
US_MARKET = re.compile(r"\b(s&p\s*500|spx|spy|wall street|u\.s\. stocks?|federal reserve|fed\b|inflation|cpi\b|jobs? report|payrolls?|treasur(?:y|ies)|earnings|recession|credit)\b", re.I)


def canonicalize_url(value: str) -> str:
    parts = urlsplit(value.strip())
    query = [(k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True)
             if not k.lower().startswith("utm_") and k.lower() not in TRACKING]
    return urlunsplit((parts.scheme.lower(), parts.netloc.lower(), parts.path.rstrip("/") or "/", urlencode(query), ""))


def normalize_title(value: str) -> str:
    value = BOILERPLATE.sub(" ", value.casefold())
    value = re.sub(r"[^\w\s]", " ", value, flags=re.UNICODE)
    return " ".join(value.split())


def stable_item_id(item: RawNewsItem) -> str:
    identity = item.source_item_id or canonicalize_url(str(item.canonical_url or item.url)) or normalize_title(item.title)
    return hashlib.sha256(f"{item.source}:{identity}".encode()).hexdigest()[:24]


def deterministic_filter(items: list[RawNewsItem], as_of: datetime) -> tuple[list[RawNewsItem], dict[str, int]]:
    cutoff = as_of.astimezone(UTC) - timedelta(hours=24)
    kept, reasons = [], defaultdict(int)
    for item in items:
        text = f"{item.title} {item.summary or ''}"
        reason = None
        if not cutoff <= item.published_at.astimezone(UTC) <= as_of.astimezone(UTC): reason = "outside_24h"
        elif not item.title.strip() or not str(item.url).startswith(("http://", "https://")): reason = "invalid_identity"
        elif SPONSORED.search(text): reason = "sponsored"
        elif TRADING.search(text): reason = "short_term_trading"
        elif not US_MARKET.search(text) and not item.tickers: reason = "not_us_equity_related"
        if reason: reasons[reason] += 1
        else: kept.append(item)
    return kept, dict(reasons)


def deduplicate(items: list[RawNewsItem]) -> tuple[list[RawNewsItem], int]:
    ordered = sorted(items, key=lambda x: (x.published_at, x.source == "alpha_vantage"), reverse=True)
    kept: list[RawNewsItem] = []
    identities: set[str] = set()
    for item in ordered:
        title = normalize_title(item.title)
        exact = {item.source_item_id or "", canonicalize_url(str(item.url)),
                 canonicalize_url(str(item.canonical_url)) if item.canonical_url else "", title} - {""}
        near = any(abs((item.published_at - old.published_at).total_seconds()) <= 6 * 3600 and
                   SequenceMatcher(None, title, normalize_title(old.title)).ratio() >= .92 for old in kept)
        if identities.intersection(exact) or near:
            continue
        identities.update(exact); kept.append(item)
    return kept, len(items) - len(kept)


def select_candidates(items: list[RawNewsItem], limit: int = 40) -> list[RawNewsItem]:
    def priority(item: RawNewsItem):
        text = f"{item.title} {item.summary or ''}".lower()
        macro = sum(word in text for word in ("fed", "inflation", "payroll", "treasury", "earnings", "credit"))
        return (macro, len(item.tickers), item.source == "alpha_vantage", item.published_at)
    return sorted(items, key=priority, reverse=True)[:limit]


def split_base_and_supplements(items: list[RawNewsItem]) -> tuple[list[RawNewsItem], list[RawNewsItem]]:
    base = [x for x in items if x.source == "alpha_vantage"]
    supplements = [x for x in items if x.source != "alpha_vantage"]
    # Deterministic de-duplication across sources ensures supplements are genuinely additive.
    combined, _ = deduplicate(base + supplements)
    accepted_ids = {stable_item_id(x) for x in combined}
    return base, [x for x in supplements if stable_item_id(x) in accepted_ids]

