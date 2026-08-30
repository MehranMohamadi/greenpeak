import os
from datetime import UTC, datetime, timedelta

os.environ["DEBUG"] = "false"
os.environ["ENVIRONMENT"] = "development"

from fastapi.testclient import TestClient

from src.api.v1.endpoints import news as news_endpoint
from src.main import app
from src.services.news.feed import alpha_source_score, build_source_feed
from src.services.news.sources import fetch_rss

NOW = datetime(2026, 8, 30, 12, tzinfo=UTC)


def document(index: int, source="alpha_vantage", relevance=.8, published=None):
    return {
        "item_id": f"item-{index}", "source": source, "title": f"News {index}",
        "summary": "<p>Full &amp; useful summary.</p>", "url": f"https://example.com/{index}",
        "published_at": published or NOW - timedelta(minutes=index), "topics": ["Financial Markets"],
        "tickers": ["SPY"], "alpha_overall_sentiment_score": .2,
        "alpha_overall_sentiment_label": "Somewhat-Bullish",
        "raw_payload": {"topics": [{"topic": "Financial Markets", "relevance_score": str(relevance)}]},
    }


def test_alpha_uses_native_relevance_and_prioritizes_medium_or_higher():
    values = [document(index, relevance=.9 - index / 100) for index in range(25)]
    assert alpha_source_score(values[0]) == .9
    feed = build_source_feed("alpha_vantage", values, 20)
    assert feed["count"] == 20
    assert feed["ranking"] == "alpha_vantage_relevance_score"
    assert feed["items"][0]["source_score"] > feed["items"][-1]["source_score"]
    assert all(item["importance"] in {"high", "medium"} for item in feed["items"])
    assert feed["searched_topics"] == ["financial_markets", "economy_monetary", "economy_macro", "earnings"]


def test_alpha_backfills_to_twenty_when_medium_pool_is_short():
    values = [document(index, relevance=.8 if index < 5 else .3 - index / 1000) for index in range(25)]
    feed = build_source_feed("alpha_vantage", values, 20)
    assert feed["count"] == 20
    assert sum(item["minimum_backfill"] for item in feed["items"]) == 15


def test_rss_has_no_fabricated_score_and_keeps_full_plain_summary():
    values = [document(1, "cnbc_rss", published=NOW - timedelta(hours=1)), document(2, "cnbc_rss", published=NOW)]
    feed = build_source_feed("cnbc_rss", values, 20)
    assert feed["items"][0]["item_id"] == "item-2"
    assert feed["items"][0]["source_score"] is None
    assert feed["items"][0]["summary"] == "Full & useful summary."
    assert feed["native_importance_score_available"] is False


def test_investing_rss_timestamp_is_parsed_as_utc(monkeypatch):
    class Response:
        content = b"""<rss><channel><item><title>Market update</title>
        <link>https://example.com/market</link>
        <pubDate>2026-08-30 05:26:18</pubDate></item></channel></rss>"""

        def raise_for_status(self):
            return None

    monkeypatch.setattr("src.services.news.sources.httpx.get", lambda *args, **kwargs: Response())
    items = fetch_rss("https://example.com/feed", "investing_rss")
    assert len(items) == 1
    assert items[0].published_at == datetime(2026, 8, 30, 5, 26, 18, tzinfo=UTC)


class FakeClient:
    def close(self): pass


class FakeRepository:
    def __init__(self, values): self.values = values; self.runs = {}
    def ensure_indexes(self): pass
    def source_raw(self, source, since, limit=500): return [x for x in self.values if x["source"] == source][:limit]
    def claim_run(self, key, kind):
        if key in self.runs: return False
        self.runs[key] = kind; return True


def test_source_api_and_bootstrap_contract(monkeypatch):
    repository = FakeRepository([document(index) for index in range(20)])
    monkeypatch.setattr(news_endpoint, "_repository", lambda: (FakeClient(), repository))
    monkeypatch.setattr(news_endpoint, "_run_bootstrap", lambda run_key: None)
    settings = news_endpoint.get_settings(); monkeypatch.setattr(settings, "alpha_vantage_key", "configured")
    client = TestClient(app)
    response = client.get("/api/v1/news/sources/alpha_vantage?limit=20")
    assert response.status_code == 200 and response.json()["data"]["count"] == 20
    assert client.get("/api/v1/news/sources/not-real").status_code == 404
    assert client.get("/api/v1/news/sources/alpha_vantage?limit=19").status_code == 422
    bootstrap = client.post("/api/v1/news/bootstrap")
    assert bootstrap.status_code == 202 and bootstrap.json()["data"]["status"] == "queued"
