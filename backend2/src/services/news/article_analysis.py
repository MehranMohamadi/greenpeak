from __future__ import annotations

from datetime import UTC, datetime
from hashlib import sha256
import html
from html.parser import HTMLParser
from ipaddress import ip_address
import re
from typing import Any
from urllib.parse import urljoin, urlparse

import httpx

from ..llm_engine.provider import LLMProvider
from ..llm_engine.prompts import default_prompt, load_text_prompt
from .schemas import NewsImpactGraph

MAX_ARTICLE_CHARS = 20_000
ARTICLE_USER_AGENT = "GreenPeak-News-Analysis/1.0"
NEWS_ANALYSIS_VERSION = "2.1.0"


class ArticleAccessError(ValueError):
    def __init__(self, code: str, http_status: int | None = None):
        super().__init__(code)
        self.code = code
        self.http_status = http_status


def access_failure(exc: Exception) -> dict:
    if isinstance(exc, ArticleAccessError):
        return {"status": exc.code, "http_status": exc.http_status}
    if isinstance(exc, httpx.HTTPStatusError):
        status = exc.response.status_code
        code = {401: "authentication_required", 402: "paywall", 403: "blocked", 429: "rate_limited"}.get(status, "http_error")
        return {"status": code, "http_status": status}
    return {"status": "network_error" if isinstance(exc, httpx.HTTPError) else "text_unavailable", "http_status": None}

NEWS_ANALYSIS_PROMPT = default_prompt("news").content


class _ArticleTextParser(HTMLParser):
    """Extract readable article text without retaining markup or page chrome."""

    _ignored_tags = {"script", "style", "noscript", "svg", "canvas", "form", "nav", "footer"}
    _preferred_tags = {"article", "main"}
    _text_tags = {"h1", "h2", "p", "li", "blockquote"}
    _void_tags = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._ignored_depth = 0
        self._preferred_depth = 0
        self._text_depth = 0
        self.preferred_parts: list[str] = []
        self._elements: list[tuple[str, bool, bool, bool]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        if tag in self._void_tags:
            return
        identifiers = " ".join(value or "" for key, value in attrs if key in {"class", "id"})
        ignored = tag in self._ignored_tags
        preferred = tag in self._preferred_tags or bool(re.search(r"article[-_]?body|story[-_]?(?:body|content)|body[-_]?copy", identifiers, re.I))
        text = tag in self._text_tags
        self._elements.append((tag, ignored, preferred, text))
        self._ignored_depth += ignored
        self._preferred_depth += preferred
        self._text_depth += text

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag.lower() not in self._void_tags:
            self.handle_endtag(tag)

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        for index in range(len(self._elements) - 1, -1, -1):
            if self._elements[index][0] == tag:
                for _, ignored, preferred, text in self._elements[index:]:
                    self._ignored_depth -= ignored
                    self._preferred_depth -= preferred
                    self._text_depth -= text
                del self._elements[index:]
                break

    def handle_data(self, data: str) -> None:
        if self._ignored_depth or not self._text_depth:
            return
        value = " ".join(data.split())
        if len(value) < 2:
            return
        if self._preferred_depth:
            self.preferred_parts.append(value)

    def text(self) -> str:
        # Navigation and subscription pages must not count as article access.
        parts = self.preferred_parts
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
    for _ in range(6):
        response = httpx.get(
            source_url,
            headers={"User-Agent": ARTICLE_USER_AGENT, "Accept": "text/html,application/xhtml+xml"},
            timeout=timeout,
            follow_redirects=False,
        )
        if getattr(response, "status_code", 200) not in {301, 302, 303, 307, 308}:
            break
        location = response.headers.get("location")
        if not location:
            raise ArticleAccessError("redirect_unavailable")
        source_url = _validate_source_url(urljoin(source_url, location))
    else:
        raise ArticleAccessError("redirect_unavailable")
    response.raise_for_status()
    if "html" not in response.headers.get("content-type", "text/html").lower():
        raise ArticleAccessError("non_html")
    page = response.text
    # Respect declared paid content; never treat a subscription teaser as the article.
    if re.search(r'"isAccessibleForFree"\s*:\s*(?:false|"false")', page, re.I):
        raise ArticleAccessError("paywall", 200)
    if re.search(r'<title[^>]*>[^<]*(?:just a moment|access denied|robot check|captcha|verify you are human)', page, re.I):
        raise ArticleAccessError("blocked", 200)
    parser = _ArticleTextParser()
    parser.feed(page)
    text = parser.text()
    if len(text) < 200:
        raise ArticleAccessError("text_unavailable", 200)
    return text


def _source_summary_text(value: Any) -> str:
    clean = re.sub(r"<[^>]+>", " ", html.unescape(str(value or "")))
    return " ".join(clean.split())


def analyze_news_document(document: dict[str, Any], provider: LLMProvider, *, prompt=None) -> dict[str, Any]:
    headline = str(document.get("title") or "").strip()
    source_url = str(document.get("url") or "").strip()
    if not headline or not source_url:
        raise ValueError("News item is missing its headline or source URL")

    evidence_type = "source_page"
    article_access = {"status": "page_text_available", "http_status": 200}
    try:
        article_text = fetch_article_text(source_url)
    except (httpx.HTTPError, ValueError) as exc:
        article_access = access_failure(exc)
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
        "article_access": article_access,
    }
    prompt = prompt or load_text_prompt("news")
    generated = provider.generate_json(prompt.content, evidence)
    title_fa = str(generated.get("title_fa") or "").strip()
    interpretation_fa = str(generated.get("interpretation_fa") or "").strip()
    if not title_fa or not interpretation_fa:
        raise ValueError("LLM news analysis is missing required fields")
    impact_graph = NewsImpactGraph.model_validate(generated.get("impact_graph")).model_dump(
        mode="json", by_alias=True
    )

    return {
        "item_id": str(document.get("item_id") or ""),
        "analysis_version": NEWS_ANALYSIS_VERSION,
        "prompt_version": prompt.version,
        "prompt_hash": prompt.hash,
        "title_fa": title_fa,
        "interpretation_fa": interpretation_fa,
        "impact_graph": impact_graph,
        "source_url": source_url,
        "evidence_type": evidence_type,
        "article_access": article_access,
        "article_content_hash": sha256(article_text.encode("utf-8")).hexdigest(),
        "article_character_count": len(article_text),
        "model": provider.model_id,
        "provider": provider.provider_id,
        "generated_at": datetime.now(UTC),
    }
