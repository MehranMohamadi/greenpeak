import os
from datetime import UTC, datetime, timedelta

os.environ["DEBUG"] = "false"
os.environ["ENVIRONMENT"] = "development"

from fastapi.testclient import TestClient

from src.main import app
from src.api.v1.endpoints import news as news_endpoint
from src.services.news.job import explain_cluster, run_qualified_refresh
from src.services.news.processing import canonicalize_url, deduplicate, deterministic_filter, normalize_title
from src.services.news.schemas import RawNewsItem


NOW = datetime(2026, 8, 27, 12, tzinfo=UTC)


def item(source="alpha_vantage", title="Fed inflation news moves S&P 500", url="https://example.com/a", hours=1, summary="US stocks and Treasury rates"):
    return RawNewsItem(source=source, source_item_id=None, url=url, title=title, summary=summary, published_at=NOW - timedelta(hours=hours), fetched_at=NOW)


def test_url_title_normalization_and_conservative_deduplication():
    assert canonicalize_url("HTTPS://EXAMPLE.COM/a/?utm_source=x&b=2#top") == "https://example.com/a?b=2"
    assert normalize_title("CNBC: Fed's MARKET update!") == "fed s"
    values, removed = deduplicate([item(), item(source="cnbc_rss", url="https://example.com/a?utm_source=rss")])
    assert len(values) == 1 and removed == 1
    values, removed = deduplicate([item(title="Fed holds rates"), item(source="cnbc_rss", title="Fed cuts rates", url="https://example.com/b")])
    assert len(values) == 2 and removed == 0


def test_filter_rejects_old_sponsored_and_irrelevant_items():
    kept, reasons = deterministic_filter([
        item(), item(url="https://example.com/old", hours=25),
        item(url="https://example.com/ad", title="Sponsored S&P 500 report"),
        item(url="https://example.com/sport", title="Local football result", source="cnbc_rss", summary="Sports only"),
    ], NOW)
    assert len(kept) == 1
    assert reasons == {"outside_24h": 1, "sponsored": 1, "not_us_equity_related": 1}


class FakeProvider:
    provider_id = "fake"; model_id = "fake"
    def __init__(self): self.calls = 0
    def generate_json(self, prompt, evidence):
        self.calls += 1
        if "Cluster articles" in prompt:
            ids = [x["id"] for x in evidence["candidates"]]
            return {"clusters": [{"cluster_id": "fed-event", "member_ids": ids, "representative_id": ids[0], "relevant_to_sp500": True, "importance_score": 90, "topic": "monetary_policy", "card_summary": "Fed policy affects the index discount rate."}], "top_topics": ["monetary_policy"], "positive_driver": "None established", "negative_driver": "Higher discount rates", "next_event": "Next Fed release"}
        return {"reason": "It changes the index discount rate.", "impact_channel": "interest rates", "likely_direction": "mixed", "confidence": "medium"}


class FakeRepository:
    def __init__(self, items): self.raw = [x.model_dump(mode="python") for x in items]; self.runs = {}; self.daily = None; self.explanations = {}
    def claim_run(self, key, kind):
        if key in self.runs: return False
        self.runs[key] = {}; return True
    def recent_raw(self, since): return self.raw
    def finish_run(self, key, status, metrics, error_code=None): self.runs[key] = {"status": status, "metrics": metrics}
    def save_daily(self, value): self.daily = value
    def latest_daily(self): return self.daily
    def explanation(self, cluster_id): return self.explanations.get(cluster_id)
    def save_explanation(self, value): self.explanations[value["cluster_id"]] = value
    def coverage_runs(self, since): return []


def test_daily_job_one_batched_call_caps_cards_and_on_demand_cache():
    repository = FakeRepository([item(), item(source="cnbc_rss", url="https://example.com/b", title="Treasury yields pressure S&P 500")])
    provider = FakeProvider()
    result = run_qualified_refresh(repository, provider, NOW)
    assert provider.calls == 1 and len(result["cards"]) == 1
    assert run_qualified_refresh(repository, provider, NOW)["status"] == "already_exists"
    cluster_id = result["cards"][0]["cluster_id"]
    first = explain_cluster(repository, provider, cluster_id)
    second = explain_cluster(repository, provider, cluster_id)
    assert first == second and provider.calls == 2


class FakeClient:
    def close(self): pass


def test_latest_and_coverage_api_contracts(monkeypatch):
    repository = FakeRepository([item()])
    repository.daily = {"run_key": "qualified:2026-08-27", "qualified_at": NOW, "cards": [], "daily_summary": {}, "metrics": {}}
    repository.coverage_runs = lambda since: [{"run_key": "qualified:2026-08-27", "status": "success", "finished_at": NOW, "metrics": {"raw_by_source": {"alpha_vantage": 4, "cnbc_rss": 2}, "deterministic_duplicates": 1, "supplement_cnbc": 1, "final_clusters": 2, "selected_by_source": {"alpha_vantage": 1, "cnbc_rss": 1}}}]
    monkeypatch.setattr(news_endpoint, "_repository", lambda: (FakeClient(), repository))
    client = TestClient(app)
    latest = client.get("/api/v1/news/daily/latest")
    assert latest.status_code == 200 and latest.json()["data"]["run_key"] == "qualified:2026-08-27"
    coverage = client.get("/api/v1/news/coverage?days=14")
    assert coverage.status_code == 200
    assert coverage.json()["data"]["totals"]["supplement_cnbc"] == 1
    assert client.get("/api/v1/news/coverage?days=0").status_code == 422
