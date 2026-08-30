from __future__ import annotations

from datetime import UTC, datetime
from email.utils import parsedate_to_datetime
from xml.etree import ElementTree

import httpx

from .schemas import RawNewsItem


def fetch_alpha(api_key: str, topic: str, timeout: float = 20) -> list[RawNewsItem]:
    response = httpx.get("https://www.alphavantage.co/query", params={"function": "NEWS_SENTIMENT", "topics": topic, "sort": "LATEST", "limit": 200, "apikey": api_key}, timeout=timeout)
    response.raise_for_status(); payload = response.json()
    if payload.get("Note") or payload.get("Information"): raise RuntimeError("Alpha Vantage quota response")
    fetched = datetime.now(UTC); result = []
    for row in payload.get("feed", []):
        published = datetime.strptime(row["time_published"], "%Y%m%dT%H%M%S").replace(tzinfo=UTC)
        result.append(RawNewsItem(source="alpha_vantage", source_item_id=row.get("url"), url=row["url"], title=row.get("title", ""), summary=row.get("summary"), published_at=published, fetched_at=fetched, topics=[x.get("topic") for x in row.get("topics", []) if x.get("topic")], tickers=[x.get("ticker") for x in row.get("ticker_sentiment", []) if x.get("ticker")], alpha_overall_sentiment_score=row.get("overall_sentiment_score"), alpha_overall_sentiment_label=row.get("overall_sentiment_label"), raw_payload=row))
    return result


def fetch_rss(url: str, source: str, timeout: float = 20) -> list[RawNewsItem]:
    response = httpx.get(url, headers={"User-Agent": "GreenPeak-News/1.0"}, timeout=timeout, follow_redirects=True)
    response.raise_for_status(); root = ElementTree.fromstring(response.content); fetched = datetime.now(UTC); result = []
    for row in root.findall(".//item"):
        title, link = row.findtext("title", "").strip(), row.findtext("link", "").strip()
        if not title or not link: continue
        raw_date = row.findtext("pubDate") or row.findtext("{http://purl.org/dc/elements/1.1/}date")
        try: published = parsedate_to_datetime(raw_date).astimezone(UTC)
        except (TypeError, ValueError): continue
        guid = row.findtext("guid")
        result.append(RawNewsItem(source=source, source_item_id=guid, url=link, title=title, summary=row.findtext("description"), published_at=published, fetched_at=fetched, raw_payload={"guid": guid, "pubDate": raw_date}))
    return result

