"""Bounded, dated evidence retrieval. Source documents are never instructions."""
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime
import re
from urllib.parse import urljoin, urlsplit
from xml.etree import ElementTree

import httpx

from ..news.article_analysis import _ArticleTextParser, ArticleAccessError
from .schemas import SourceInput
from .store import Missing, digest, encode, now_iso

ALLOWED_DOMAINS = ("federalreserve.gov", "bls.gov", "bea.gov", "sec.gov", "treasury.gov",
                   "fred.stlouisfed.org", "cnbc.com", "barrons.com")
FEEDS = {
    "Federal Reserve": "https://www.federalreserve.gov/feeds/press_all.xml",
    "BLS": "https://www.bls.gov/feed/bls_latest.rss",
    "BEA": "https://apps.bea.gov/rss/rss.xml",
}


def utc(value):
    if isinstance(value, str):
        value = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def safe_url(url):
    parsed = urlsplit(url)
    if (parsed.scheme != "https" or parsed.username or parsed.password or parsed.port not in {None, 443}
            or not any(parsed.hostname == domain or (parsed.hostname or "").endswith("." + domain)
                       for domain in ALLOWED_DOMAINS)):
        raise ValueError("URL must belong to an approved HTTPS source")
    return url


def fetch_bytes(url):
    for _ in range(3):
        url = safe_url(url)
        with httpx.stream("GET", url, timeout=8, follow_redirects=False,
                          headers={"User-Agent": "GreenPeak-Research/1.0 contact admin@greenpeak.ir"}) as response:
            if response.status_code in {301, 302, 303, 307, 308}:
                url = safe_url(urljoin(url, response.headers.get("location", "")))
                continue
            response.raise_for_status()
            data = bytearray()
            for block in response.iter_bytes():
                data.extend(block)
                if len(data) > 1_000_000:
                    raise ValueError("Source exceeds the one-megabyte retrieval limit")
            return bytes(data)
    raise ValueError("Too many redirects")


def fetch_text(url):
    page = fetch_bytes(url).decode("utf-8", errors="replace")
    if re.search(r'"isAccessibleForFree"\s*:\s*(?:false|"false")', page, re.I):
        raise ArticleAccessError("paywall")
    if re.search(r'<title[^>]*>[^<]*(?:just a moment|access denied|robot check|captcha|verify you are human)', page, re.I):
        raise ArticleAccessError("blocked")
    parser = _ArticleTextParser()
    parser.feed(page)
    content = parser.text()
    if len(content) < 200:
        raise ArticleAccessError("text_unavailable")
    return content


def tokens(text):
    return set(re.findall(r"[\w\u200c]{3,}", str(text).lower()))


def search_web(query, now=None):
    """Search current official RSS headlines, reporting each source's availability."""
    now = now or datetime.now(UTC)
    terms = tokens(query)

    def read(entry):
        publisher, url = entry
        items = []
        try:
            root = ElementTree.fromstring(fetch_bytes(url))
            for item in root.findall(".//item")[:60]:
                title, link = item.findtext("title", ""), item.findtext("link", "")
                try:
                    published = parsedate_to_datetime(item.findtext("pubDate", ""))
                    published = utc(published)
                    safe_url(link)
                except (ValueError, TypeError, AttributeError):
                    continue
                if published > now or (now - published).days > 60:
                    continue
                description = re.sub(r"<[^>]+>", " ", item.findtext("description", ""))[:700]
                score = len(terms & tokens(title + " " + description))
                if score:
                    items.append({"title": title[:300], "source_url": link, "publisher": publisher,
                                  "published_at": published.isoformat(), "excerpt": description,
                                  "score": score, "retrieved_at": now.isoformat()})
            return {"publisher": publisher, "status": "available", "items": items}
        except (httpx.HTTPError, ValueError, ElementTree.ParseError):
            return {"publisher": publisher, "status": "unavailable", "items": []}

    with ThreadPoolExecutor(max_workers=3) as pool:
        feeds = list(pool.map(read, FEEDS.items()))
    results = sorted((item for feed in feeds for item in feed["items"]),
                     key=lambda item: (item["score"], item["published_at"]), reverse=True)[:12]
    return {"query": query, "searched_at": now.isoformat(), "items": results,
            "sources": [{"publisher": feed["publisher"], "status": feed["status"]} for feed in feeds],
            "scope": "Official Fed/BLS/BEA RSS headlines from the last 60 days; not a full-web search"}


def create_source(store, body: SourceInput, actor):
    value = body.model_dump(mode="json")
    # Keep sections bounded; preserve paragraph context and exact source attribution.
    paragraphs = re.split(r"\n\s*\n", body.content)
    chunks, pending = [], ""
    for paragraph in paragraphs:
        for start in range(0, len(paragraph), 1800):
            part = paragraph[start:start + 1800]
            if len(pending) + len(part) > 2200:
                chunks.append(pending.strip())
                pending = ""
            pending += "\n\n" + part
    if pending.strip():
        chunks.append(pending.strip())
    value.update(chunks=chunks, approved=False, imported_at=now_iso(), content_hash=digest(body.content))
    return store.create_once("source", value, digest([body.source_url, value["published_at"], body.content]), actor)


def context_for_analysis(store, kind, at, query=""):
    """Called only for new reports. Evaluation reuses the captured context verbatim."""
    at = utc(at)
    horizon = "pulse" if kind in {"session", "weekend"} else "short" if kind == "daily" else "medium"
    terms = tokens(query)
    ranked = []
    for source in store.list("source", 500):
        if not source.get("approved"):
            continue
        if not utc(source["published_at"]) <= at < utc(source["expires_at"]):
            continue
        if utc(source["imported_at"]) > at:
            continue
        if kind in {"session", "weekend"}:
            from zoneinfo import ZoneInfo
            if source["horizon"] != "pulse" or utc(source["published_at"]).astimezone(ZoneInfo("Asia/Tehran")).date() != at.astimezone(ZoneInfo("Asia/Tehran")).date():
                continue
        elif kind == "daily" and source["horizon"] == "medium":
            continue
        for index, chunk in enumerate(source["chunks"]):
            score = len(terms & tokens(source["title"] + " " + source.get("topics", "") + " " + chunk))
            ranked.append((score, source["published_at"], source, index, chunk))
    ranked.sort(key=lambda item: (item[0], item[1]), reverse=True)
    selected, per_source = [], {}
    for _, _, source, index, chunk in ranked:
        if per_source.get(source["id"], 0) >= 2:
            continue
        per_source[source["id"]] = per_source.get(source["id"], 0) + 1
        selected.append({"source_id": source["id"], "chunk_index": index, "title": source["title"],
                         "publisher": source["publisher"], "author": source.get("author", ""), "source_url": source["source_url"],
                         "published_at": source["published_at"], "expires_at": source["expires_at"],
                         "kind": source["kind"], "horizon": source["horizon"], "excerpt": chunk})
        if len(selected) == 5:
            break
    memory = []
    if horizon != "pulse":
        for item in store.list("hypothesis", 100):
            if item["status"] in {"realized", "invalidated", "inconclusive"} or utc(item["updated_at"]) > at:
                continue
            if horizon == "short" and item["horizon"] != "short":
                continue
            memory.append({key: item[key] for key in ("id", "title", "horizon", "thesis", "invalidation", "status", "due_at", "report_id")})
            if len(memory) == 8:
                break
    examples = []
    if horizon != "pulse":
        for item in store.list("feedback", 100):
            case = store.get("report", item["report_id"])
            if case["split"] == "development" and item.get("approved_example") and item.get("correction") and utc(item["updated_at"]) <= at:
                examples.append({"lesson": item["correction"][:1200], "usage": "Reviewed writing example; not independent market evidence"})
                if len(examples) == 2:
                    break
    context = {"research_sources": selected, "hypothesis_memory": memory, "reviewed_examples": examples}
    # Drop whole lower-priority entries; never shorten away a thesis's condition
    # or a source excerpt's counterevidence merely to fit the token budget.
    while len(encode(context)) > 24000:
        if examples:
            examples.pop()
        elif memory:
            memory.pop()
        elif selected:
            selected.pop()
        else:
            break
    return context


def filter_retained_sources(store, retained, at):
    """Expiry/revocation also applies to copied excerpts in previous factors."""
    result = {}
    for key, value in (retained or {}).items():
        if not isinstance(value, dict) or not {"source_id", "chunk_index", "expires_at"} <= value.keys():
            result[key] = value
            continue
        try:
            source = store.get("source", value["source_id"])
        except Missing:
            continue
        if source.get("approved") and utc(source["published_at"]) <= utc(at) < utc(source["expires_at"]):
            result[key] = value
    return result
