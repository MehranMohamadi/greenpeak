"""CNBC selection, read-only RSS fallback, and API contract checks."""

from copy import deepcopy
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import httpx
import pytest
from fastapi.testclient import TestClient
from pymongo.errors import ServerSelectionTimeoutError

from src.api.v1.endpoints import news as endpoint
from src.main import app
from src.services.news import highlights
from src.services.news.schemas import RawNewsItem


NOW = datetime(2026, 10, 16, 9, tzinfo=UTC)


def story(index, title=None, **changes):
    return {
        "item_id": f"cnbc-{index}", "source": "cnbc_rss",
        "title": title or f"Market story {index}", "summary": "<p>A CNBC summary &amp; source detail.</p>",
        "url": f"https://www.cnbc.com/2026/10/16/story-{index}.html",
        "published_at": NOW - timedelta(minutes=index), "fetched_at": NOW,
        **changes,
    }


@pytest.fixture(autouse=True)
def isolate_rss_cache():
    highlights._rss_cache.clear()
    yield
    highlights._rss_cache.clear()


def unavailable(*args, **kwargs):
    raise httpx.ConnectError("private upstream error")


def test_selects_four_relevant_stories_ahead_of_newer_lifestyle_news():
    values = [
        story(0, "Best restaurants for a weekend trip"),
        story(1, "Fed rate decision sends S&P 500 futures higher"),
        story(2, "CPI inflation report shifts Treasury yields"),
        story(3, "Nvidia earnings and revenue beat forecasts"),
        story(4, "Oil prices rise as tariffs threaten trade"),
        story(5, "A new vacation destination"),
    ]
    original = deepcopy(values)
    feed = highlights.build_cnbc_highlights(values, now=NOW)
    assert feed.count == 4
    assert {item.item_id for item in feed.items} == {"cnbc-1", "cnbc-2", "cnbc-3", "cnbc-4"}
    assert [item.selection_rank for item in feed.items] == [1, 2, 3, 4]
    assert all(item.source_score is None for item in feed.items)
    assert feed.native_importance_score_available is False
    assert "سیاست پولی" in feed.items[0].selection_reason_fa
    assert all(item.summary == "A CNBC summary & source detail." for item in feed.items)
    assert values == original
    assert feed == highlights.build_cnbc_highlights(list(reversed(values)), now=NOW)


def test_deduplicates_tracked_urls_headlines_and_ids_without_filler():
    original = story(1, "Fed interest rate decision")
    tracked = {**original, "item_id": "duplicate-url", "url": original["url"] + "?__source=rss#story"}
    repeated_title = story(2, "FED interest rate decision!")
    repeated_id = {**story(3), "item_id": original["item_id"]}
    feed = highlights.build_cnbc_highlights([original, tracked, repeated_title, repeated_id], now=NOW)
    assert feed.count == 1
    assert "?" not in str(feed.items[0].url)
    assert highlights.build_cnbc_highlights([], now=NOW).count == 0


def test_recent_stories_rank_ahead_of_week_old_reports():
    older = story(1, "Fed CPI inflation earnings Nasdaq report", published_at=NOW - timedelta(days=6))
    fresh = [story(i) for i in range(2, 6)]
    assert [item.item_id for item in highlights.build_cnbc_highlights([older, *fresh], now=NOW).items] == [item["item_id"] for item in fresh]
    short = highlights.build_cnbc_highlights([older], now=NOW)
    assert short.count == 1 and short.stale is True


def test_invalid_records_and_non_cnbc_links_are_omitted():
    invalid = [
        None, {}, story(1, title=123), story(2, url="javascript:alert(1)"),
        story(3, source="alpha_vantage"), story(4, url="https://cnbc.com.evil.test/news"),
        story(5, published_at="not-a-date"), story(6, published_at=NOW + timedelta(days=1)),
        story(7, published_at=NOW - timedelta(days=8)),
    ]
    valid = story(8, published_at=NOW.replace(tzinfo=None), summary=123)
    feed = highlights.build_cnbc_highlights([*invalid, valid], now=NOW)
    assert feed.count == 1
    assert feed.items[0].published_at.tzinfo is UTC
    assert feed.items[0].summary is None


def test_fresh_database_feed_needs_no_live_request(monkeypatch):
    monkeypatch.setattr(highlights, "fetch_rss", lambda *args, **kwargs: pytest.fail("Unexpected network access"))
    feed = highlights.get_cnbc_highlights([story(i) for i in range(4)], "https://feed.test", now=NOW)
    assert feed.count == 4 and feed.data_origin == "database"
    assert all(item.analysis_available for item in feed.items)


def test_rss_fallback_is_cached_and_does_not_require_mongodb(monkeypatch):
    now = datetime.now(UTC)
    received = []

    def fetch(url, source, **kwargs):
        received.append((url, source))
        return [RawNewsItem.model_validate(story(i, published_at=now - timedelta(minutes=i), fetched_at=now)) for i in range(6)]

    def database_unavailable():
        raise ServerSelectionTimeoutError("private MongoDB connection details")

    monkeypatch.setattr(endpoint, "_repository", database_unavailable)
    monkeypatch.setattr(highlights, "fetch_rss", fetch)
    client = TestClient(app)
    for _ in range(2):
        response = client.get("/api/v1/news/highlights/cnbc")
        assert response.status_code == 200
        data = response.json()["data"]
        assert data["count"] == len(data["items"]) == 4
        assert data["data_origin"] == "rss"
        assert all(item["source"] == "cnbc_rss" and not item["analysis_available"] for item in data["items"])
        assert "private MongoDB" not in response.text
    assert len(received) == 1


def test_api_reads_database_without_writing_or_fetching(monkeypatch):
    now = datetime.now(UTC)
    closed = []
    repository = SimpleNamespace(source_raw=lambda source, since: [story(i, fetched_at=now, published_at=now) for i in range(4)])
    monkeypatch.setattr(endpoint, "_repository", lambda: (SimpleNamespace(close=lambda: closed.append(True)), repository))
    monkeypatch.setattr(highlights, "fetch_rss", lambda *args, **kwargs: pytest.fail("Unexpected network access"))
    response = TestClient(app).get("/api/v1/news/highlights/cnbc")
    assert response.status_code == 200
    assert response.json()["data"]["data_origin"] == "database"
    assert closed == [True]


def test_source_failure_returns_stored_news_and_keeps_staleness_visible(monkeypatch):
    monkeypatch.setattr(highlights, "fetch_rss", unavailable)
    feed = highlights.get_cnbc_highlights([story(1, published_at=NOW - timedelta(days=3))], "https://feed.test", now=NOW)
    assert feed.count == 1 and feed.stale is True


def test_no_source_returns_sanitized_error_instead_of_fake_news(monkeypatch):
    monkeypatch.setattr(endpoint, "_repository", lambda: (_ for _ in ()).throw(ServerSelectionTimeoutError("private database")))
    monkeypatch.setattr(highlights, "fetch_rss", unavailable)
    response = TestClient(app).get("/api/v1/news/highlights/cnbc")
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "CNBC_NEWS_UNAVAILABLE"
    assert "private" not in response.text


def test_expired_live_cache_is_refreshed(monkeypatch):
    calls = []
    tick = [100.0]
    monkeypatch.setattr(highlights, "monotonic", lambda: tick[0])
    monkeypatch.setattr(highlights, "fetch_rss", lambda *args, **kwargs: (calls.append(True) or [RawNewsItem.model_validate(story(i)) for i in range(4)]))
    for time in [100, 200, 401]:
        tick[0] = time
        assert highlights.get_cnbc_highlights([], "https://feed.test", now=NOW).count == 4
    assert len(calls) == 2
