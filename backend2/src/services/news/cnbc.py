"""Combine the CNBC workbook's primary feeds and Finance supplement."""

from urllib.parse import urlsplit, urlunsplit
from xml.etree.ElementTree import ParseError

import httpx

from .source_config import CNBC_SECTIONS
from .sources import fetch_rss


def cnbc_article_key(url: str) -> str:
    parsed = urlsplit(url)
    host = (parsed.hostname or "").lower()
    if host == "cnbc.com" or host.endswith(".cnbc.com"):
        # CNBC uses query parameters for feed tracking; article identity is its path.
        return urlunsplit(("https", "www.cnbc.com" if host == "cnbc.com" else host, parsed.path, "", ""))
    return url


def fetch_cnbc_sections(settings, *, fetcher=fetch_rss):
    combined, results = {}, {}
    for section, _, _, _, setting in CNBC_SECTIONS:
        try:
            items = fetcher(getattr(settings, setting), "cnbc_rss")
        except (httpx.HTTPError, ParseError, ValueError) as exc:
            results[section] = {"status": "error", "error_code": type(exc).__name__, "received": 0}
            continue
        results[section] = {"status": "available" if items else "empty", "received": len(items)}
        for item in items:
            key = cnbc_article_key(str(item.canonical_url or item.url))
            if key in combined:
                if section not in combined[key].sections:
                    combined[key].sections.append(section)
            else:
                combined[key] = item.model_copy(deep=True, update={"sections": [section]})
    return sorted(combined.values(), key=lambda item: item.published_at, reverse=True), results
