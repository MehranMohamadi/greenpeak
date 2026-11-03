import os
from datetime import UTC, datetime, timedelta

os.environ["DEBUG"] = "false"

import httpx
import pytest
from fastapi.testclient import TestClient

from src.api.v1.endpoints import news as endpoint
from src.main import app
from src.services.news import access_review, article_analysis
from src.services.news import scheduler
from src.services.news.schemas import NewsAccessReportResponse
from src.services.news.source_config import ACTIVE_SOURCE_IDS, DEFAULT_SOURCE_ID, rss_sources
from src.core.config import get_settings

NOW = datetime(2026, 11, 3, 12, tzinfo=UTC)


class Repository:
    def __init__(self):
        self.review = None
        self.runs = {}

    def start_access_review(self, review_id, day):
        if self.review is None:
            self.review = {"start_date": day}
        return self.review

    def claim_run(self, key, kind):
        if key in self.runs:
            return False
        self.runs[key] = {"kind": kind}
        return True

    def finish_run(self, key, status, metrics):
        self.runs[key].update(status=status, metrics=metrics)

    def access_review(self, review_id):
        return self.review

    def access_review_runs(self, review_id):
        return list(self.runs.values())


def documents():
    return [{"item_id": f"item-{i}", "url": f"https://example.com/{i}", "published_at": NOW - timedelta(minutes=i)} for i in range(5)]


def test_daily_review_is_bounded_idempotent_and_stops_after_ten_tehran_dates(monkeypatch):
    repository = Repository()
    calls = []
    monkeypatch.setattr(access_review, "fetch_article_text", lambda url: calls.append(url) or "article text" * 100)
    for day in range(12):
        for _ in range(2):
            access_review.review_source_access(repository, "bloomberg_rss", documents(), now=NOW + timedelta(days=day))
    assert len(calls) == 30
    assert len(repository.runs) == 10
    assert repository.review["start_date"] == "2026-11-03"
    report = access_review.build_access_report(repository.review, list(repository.runs.values()), now=NOW + timedelta(days=10))
    result = report["sources"][0]
    assert report["status"] == "completed"
    assert report["end_date_exclusive"] == "2026-11-13"
    assert result["sampled_days"] == 10
    assert result["attempts"] == result["page_text_available"] == 30
    assert all("article_text" not in sample for day in result["days"] for sample in day["samples"])
    NewsAccessReportResponse(data=report)


def test_review_separates_blocked_page_empty_feed_and_feed_failure(monkeypatch):
    repository = Repository()

    def blocked(url):
        raise httpx.HTTPStatusError("denied", request=httpx.Request("GET", url), response=httpx.Response(403))

    monkeypatch.setattr(access_review, "fetch_article_text", blocked)
    access_review.review_source_access(repository, "cnbc_rss", documents(), now=NOW)
    access_review.review_source_access(repository, "wsj_rss", [], now=NOW, feed_error="ConnectError")
    access_review.review_source_access(repository, "nytimes_rss", [], now=NOW)
    report = access_review.build_access_report(repository.review, list(repository.runs.values()), now=NOW)
    cnbc, wsj, nyt = report["sources"][1:4]
    assert cnbc["status_counts"] == {"blocked": 3}
    assert cnbc["page_text_available"] == 0
    assert wsj["attempts"] == 0 and wsj["feed_error_days"] == 1
    assert nyt["attempts"] == 0 and nyt["feed_error_days"] == 0
    assert nyt["days"][0]["feed_status"] == "empty"


def test_review_dates_use_tehran_midnight(monkeypatch):
    repository = Repository()
    access_review.review_source_access(repository, "wsj_rss", [], now=datetime(2026, 11, 3, 21, tzinfo=UTC))
    assert repository.review["start_date"] == "2026-11-04"


@pytest.mark.parametrize("status,expected", [(401, "authentication_required"), (402, "paywall"), (403, "blocked"), (429, "rate_limited"), (500, "http_error")])
def test_article_http_failures_are_distinguished(status, expected):
    error = httpx.HTTPStatusError("unavailable", request=httpx.Request("GET", "https://example.com"), response=httpx.Response(status))
    assert article_analysis.access_failure(error) == {"status": expected, "http_status": status}


@pytest.mark.parametrize("html,expected", [
    ('<script type="application/ld+json">{"isAccessibleForFree": false}</script><article><p>' + 'paid text ' * 100 + '</p></article>', "paywall"),
    ('<title>Just a moment...</title><main><p>' + 'challenge text ' * 100 + '</p></main>', "blocked"),
    ('<nav><p>' + 'navigation ' * 100 + '</p></nav><footer><p>More links</p></footer>', "text_unavailable"),
])
def test_subscription_and_challenge_pages_are_not_success(monkeypatch, html, expected):
    response = httpx.Response(200, text=html, headers={"content-type": "text/html"}, request=httpx.Request("GET", "https://example.com"))
    monkeypatch.setattr(article_analysis.httpx, "get", lambda *args, **kwargs: response)
    with pytest.raises(article_analysis.ArticleAccessError) as error:
        article_analysis.fetch_article_text("https://example.com")
    assert error.value.code == expected


def test_redirect_does_not_fetch_private_literal_address(monkeypatch):
    calls = []

    def redirect(url, **kwargs):
        calls.append(url)
        return httpx.Response(302, headers={"location": "http://127.0.0.1/private"})

    monkeypatch.setattr(article_analysis.httpx, "get", redirect)
    with pytest.raises(ValueError, match="Private"):
        article_analysis.fetch_article_text("https://example.com/article")
    assert len(calls) == 1


def test_cnbc_article_body_div_is_read_without_navigation_or_related_links(monkeypatch):
    body = "Markets responded to the latest inflation and interest rate news. " * 12
    html = f'<nav><p>Navigation</p></nav><div class="ArticleBody-articleBody"><div><p>{body}<br />More context.</p></div></div><div><p>Related stories</p></div>'
    response = httpx.Response(200, text=html, headers={"content-type": "text/html"}, request=httpx.Request("GET", "https://example.com"))
    monkeypatch.setattr(article_analysis.httpx, "get", lambda *args, **kwargs: response)
    result = article_analysis.fetch_article_text("https://example.com")
    assert body.strip() in result
    assert "Related stories" not in result and "Navigation" not in result


def test_review_api_contract_and_health(monkeypatch):
    repository = Repository()
    client = type("Client", (), {"close": lambda self: None})()
    monkeypatch.setattr(endpoint, "_repository", lambda: (client, repository))
    api = TestClient(app)
    assert api.get("/health").status_code == 200
    result = api.get("/api/v1/news/access-review")
    assert result.status_code == 200
    assert result.json()["data"]["status"] == "pending"
    assert len(result.json()["data"]["sources"]) == 5
    assert DEFAULT_SOURCE_ID == "bloomberg_rss"
    assert set(rss_sources(get_settings())) == set(ACTIVE_SOURCE_IDS)


@pytest.mark.parametrize("source", ACTIVE_SOURCE_IDS)
def test_each_selected_publisher_has_a_working_feed_contract(monkeypatch, source):
    class FeedRepository:
        def source_raw(self, value, since):
            assert value == source
            return [{**documents()[0], "source": source, "title": "A market headline"}]

        def article_analyses(self, item_ids, version):
            return []

    client = type("Client", (), {"close": lambda self: None})()
    monkeypatch.setattr(endpoint, "_repository", lambda: (client, FeedRepository()))
    response = TestClient(app).get(f"/api/v1/news/sources/{source}?limit=20")
    assert response.status_code == 200
    assert response.json()["data"]["source"] == source
    assert response.json()["data"]["items"][0]["source_score"] is None


def test_ingestion_runs_all_five_feeds_and_isolates_review_failures(monkeypatch):
    fetched, reviewed, saved = [], [], []

    class IngestRepository(Repository):
        def ensure_indexes(self):
            pass

        def save_raw(self, values):
            saved.extend(values)
            return len(values)

    repository = IngestRepository()
    client = type("Client", (), {"close": lambda self: None})()
    monkeypatch.setattr(scheduler, "MongoClient", lambda *args, **kwargs: client)
    monkeypatch.setattr(scheduler, "MongoNewsRepository", lambda *args: repository)

    def fetch(url, source):
        from src.services.news.schemas import RawNewsItem
        fetched.append(source)
        return [RawNewsItem(source=source, url="https://example.com/story", title="A market headline", published_at=NOW, fetched_at=NOW)]

    def review(repository, source, documents, **kwargs):
        reviewed.append(source)
        if source == "bloomberg_rss":
            raise RuntimeError("monitor failure")

    monkeypatch.setattr(scheduler, "fetch_rss", fetch)
    monkeypatch.setattr(scheduler, "review_source_access", review)
    scheduler.ingest_news()
    assert reviewed == list(ACTIVE_SOURCE_IDS)
    assert fetched == ["bloomberg_rss", *(["cnbc_rss"] * 4), "wsj_rss", "nytimes_rss", "economist_rss"]
    assert len(saved) == 5
    assert next(iter(repository.runs.values()))["status"] == "success"
