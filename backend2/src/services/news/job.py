from __future__ import annotations

import hashlib
from datetime import UTC, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from .processing import deterministic_filter, deduplicate, select_candidates, split_base_and_supplements, stable_item_id
from .schemas import DailySelection, RawNewsItem, WhyImportant

TOPICS = ("financial_markets", "economy_monetary", "economy_macro", "earnings")
ALPHA_TOPIC_ROTATION = (
    "financial_markets", "economy_monetary", "economy_macro", "financial_markets",
    "economy_monetary", "economy_macro", "financial_markets", "earnings",
)


def _llm_evidence(items: list[RawNewsItem]) -> dict[str, Any]:
    return {"scope": "S&P 500", "candidates": [{"id": stable_item_id(x), "source": x.source, "title": x.title, "summary": x.summary, "published_at": x.published_at.isoformat(), "topics": x.topics, "tickers": x.tickers} for x in items]}


DAILY_PROMPT = """You select only material S&P 500 events. Cluster articles about the same event and choose one representative. Return strict JSON matching: {clusters:[{cluster_id,member_ids,representative_id,relevant_to_sp500,importance_score,topic,card_summary}],top_topics:[string],positive_driver:string,negative_driver:string,next_event:string}. Use only supplied IDs. Score impact on index discount rates, aggregate earnings, valuation, or market risk. Never make source prestige itself important."""
WHY_PROMPT = """Explain why this event matters to the S&P 500 using only supplied article evidence. Return strict JSON: {reason,impact_channel,likely_direction,confidence}. likely_direction is positive, negative, mixed, or unclear; confidence is low, medium, or high. Do not give investment advice."""


def run_qualified_refresh(repository, provider, as_of: datetime | None = None) -> dict:
    as_of = (as_of or datetime.now(UTC)).astimezone(UTC)
    local_day = as_of.astimezone(ZoneInfo("Asia/Tehran")).date().isoformat()
    run_key = f"qualified:{local_day}"
    if not repository.claim_run(run_key, "qualified"): return {"status": "already_exists", "run_key": run_key}
    metrics: dict[str, Any] = {}
    try:
        raw_docs = repository.recent_raw(as_of - timedelta(hours=24))
        raw = [RawNewsItem.model_validate(x) for x in raw_docs]
        metrics["raw_by_source"] = {source: sum(x.source == source for x in raw) for source in ("alpha_vantage", "cnbc_rss", "investing_rss")}
        filtered, reasons = deterministic_filter(raw, as_of); unique, removed = deduplicate(filtered)
        base, supplements = split_base_and_supplements(unique)
        candidates = select_candidates(base + supplements, 40)
        metrics.update({"filter_reasons": reasons, "deterministic_duplicates": removed, "supplement_cnbc": sum(x.source == "cnbc_rss" for x in supplements), "supplement_investing": sum(x.source == "investing_rss" for x in supplements), "llm_candidates": len(candidates)})
        selection = DailySelection.model_validate(provider.generate_json(DAILY_PROMPT, _llm_evidence(candidates)))
        by_id = {stable_item_id(x): x for x in candidates}
        valid = [c for c in selection.clusters if c.relevant_to_sp500 and c.representative_id in by_id and set(c.member_ids) <= set(by_id)]
        valid.sort(key=lambda x: x.importance_score, reverse=True)
        # Reject overlapping model clusters so an event can produce only one card.
        disjoint, assigned = [], set()
        for cluster in valid:
            if assigned.intersection(cluster.member_ids): continue
            disjoint.append(cluster); assigned.update(cluster.member_ids)
        valid = disjoint[:12]
        cards = []
        for rank, cluster in enumerate(valid):
            item = by_id[cluster.representative_id]
            cluster_id = hashlib.sha256("|".join(sorted(cluster.member_ids)).encode()).hexdigest()[:24]
            cards.append({"cluster_id": cluster_id, "title": item.title, "summary": cluster.card_summary or item.summary, "published_at": item.published_at, "topic": cluster.topic, "source": item.source, "source_count": len({by_id[x].source for x in cluster.member_ids}), "url": str(item.url), "importance_score": cluster.importance_score, "tier": "main" if rank < 5 else "supplement", "member_ids": cluster.member_ids, "news_sentiment": {"score": item.alpha_overall_sentiment_score, "label": item.alpha_overall_sentiment_label}})
        metrics["final_clusters"] = len(cards); metrics["selected_by_source"] = {s: sum(c["source"] == s for c in cards) for s in ("alpha_vantage", "cnbc_rss", "investing_rss")}
        document = {"run_key": run_key, "qualified_at": as_of, "window_hours": 24, "cards": cards, "daily_summary": selection.model_dump(exclude={"clusters"}), "metrics": metrics}
        repository.save_daily(document); repository.finish_run(run_key, "success", metrics)
        return document
    except Exception as exc:
        repository.finish_run(run_key, "failed", metrics, type(exc).__name__); raise


def explain_cluster(repository, provider, cluster_id: str) -> dict:
    cached = repository.explanation(cluster_id)
    if cached: return cached
    daily = repository.latest_daily()
    card = next((x for x in (daily or {}).get("cards", []) if x["cluster_id"] == cluster_id), None)
    if not card: raise KeyError(cluster_id)
    result = WhyImportant.model_validate(provider.generate_json(WHY_PROMPT, {"scope": "S&P 500", "event": {k: card[k] for k in ("title", "summary", "topic", "source_count")}}))
    document = {"cluster_id": cluster_id, "generated_at": datetime.now(UTC), **result.model_dump()}
    repository.save_explanation(document)
    return repository.explanation(cluster_id) or document
