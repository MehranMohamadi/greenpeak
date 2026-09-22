from __future__ import annotations

from datetime import UTC, datetime
from hashlib import sha256
import html
from html.parser import HTMLParser
from ipaddress import ip_address
import re
from typing import Any
from urllib.parse import urlparse

import httpx

from ..llm_engine.provider import LLMProvider

MAX_ARTICLE_CHARS = 20_000
ARTICLE_USER_AGENT = "GreenPeak-News-Analysis/1.0"
NEWS_ANALYSIS_VERSION = "1.0.0"

NEWS_ANALYSIS_PROMPT = """You analyze one English-language market news article for a Persian financial dashboard.
Return one JSON object with exactly these string fields:
- title_fa: a faithful, natural Persian translation of english_headline; do not replace it with a generic analysis title.
- interpretation_fa: a concise Persian interpretation of the article and its plausible relevance to the S&P 500.

Use only the supplied article_text, headline, publisher metadata, and publication time. Separate reported facts from interpretation, do not invent missing details, do not give investment advice, and mention material uncertainty. Do not reproduce long passages from the article."""


class _ArticleTextParser(HTMLParser):
    """Extract readable article text without retaining markup or page chrome."""

    _ignored_tags = {"script", "style", "noscript", "svg", "canvas", "form", "nav", "footer"}
    _preferred_tags = {"article", "main"}
    _text_tags = {"h1", "h2", "p", "li", "blockquote"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._ignored_depth = 0
        self._preferred_depth = 0
        self._text_depth = 0
        self.preferred_parts: list[str] = []
        self.fallback_parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        del attrs
        tag = tag.lower()
        if tag in self._ignored_tags:
            self._ignored_depth += 1
        if tag in self._preferred_tags:
            self._preferred_depth += 1
        if tag in self._text_tags:
            self._text_depth += 1

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag in self._text_tags and self._text_depth:
            self._text_depth -= 1
        if tag in self._preferred_tags and self._preferred_depth:
            self._preferred_depth -= 1
        if tag in self._ignored_tags and self._ignored_depth:
            self._ignored_depth -= 1

    def handle_data(self, data: str) -> None:
        if self._ignored_depth or not self._text_depth:
            return
        value = " ".join(data.split())
        if len(value) < 2:
            return
        self.fallback_parts.append(value)
        if self._preferred_depth:
            self.preferred_parts.append(value)

    def text(self) -> str:
        parts = self.preferred_parts if len(" ".join(self.preferred_parts)) >= 300 else self.fallback_parts
        return "\n".join(dict.fromkeys(parts))[:MAX_ARTICLE_CHARS]


def _validate_source_url(value: str) -> str:
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError("Unsupported article URL")
    hostname = parsed.hostname.lower()
    if hostname in {"localhost", "localhost.localdomain"} or hostname.endswith(".local"):
        raise ValueError("Local article URLs are not allowed")
    try:
        address = ip_address(hostname)
    except ValueError:
        address = None
    if address and (address.is_private or address.is_loopback or address.is_link_local or address.is_reserved):
        raise ValueError("Private article URLs are not allowed")
    return value


def fetch_article_text(url: str, *, timeout: float = 20) -> str:
    source_url = _validate_source_url(url)
    response = httpx.get(
        source_url,
        headers={"User-Agent": ARTICLE_USER_AGENT, "Accept": "text/html,application/xhtml+xml"},
        timeout=timeout,
        follow_redirects=True,
    )
    response.raise_for_status()
    if "html" not in response.headers.get("content-type", "text/html").lower():
        raise ValueError("Article source did not return HTML")
    parser = _ArticleTextParser()
    parser.feed(response.text)
    text = parser.text()
    if len(text) < 200:
        raise ValueError("Article text was not available on the source page")
    return text


def _source_summary_text(value: Any) -> str:
    clean = re.sub(r"<[^>]+>", " ", html.unescape(str(value or "")))
    return " ".join(clean.split())


def analyze_news_document(document: dict[str, Any], provider: LLMProvider) -> dict[str, Any]:
    headline = str(document.get("title") or "").strip()
    source_url = str(document.get("url") or "").strip()
    if not headline or not source_url:
        raise ValueError("News item is missing its headline or source URL")

    evidence_type = "source_page"
    try:
        article_text = fetch_article_text(source_url)
    except (httpx.HTTPError, ValueError):
        article_text = _source_summary_text(document.get("summary"))
        evidence_type = "source_summary"
    if len(article_text) < 80:
        raise ValueError("No usable article text or source summary was available")

    evidence = {
        "english_headline": headline,
        "article_text": article_text[:MAX_ARTICLE_CHARS],
        "publisher": document.get("source"),
        "published_at": document.get("published_at"),
        "source_url": source_url,
        "evidence_type": evidence_type,
    }
    generated = provider.generate_json(NEWS_ANALYSIS_PROMPT, evidence)
    title_fa = str(generated.get("title_fa") or "").strip()
    interpretation_fa = str(generated.get("interpretation_fa") or "").strip()
    if not title_fa or not interpretation_fa:
        raise ValueError("LLM news analysis is missing required fields")

    return {
        "item_id": str(document.get("item_id") or ""),
        "analysis_version": NEWS_ANALYSIS_VERSION,
        "title_fa": title_fa,
        "interpretation_fa": interpretation_fa,
        "source_url": source_url,
        "evidence_type": evidence_type,
        "article_content_hash": sha256(article_text.encode("utf-8")).hexdigest(),
        "article_character_count": len(article_text),
        "model": provider.model_id,
        "provider": provider.provider_id,
        "generated_at": datetime.now(UTC),
    }
