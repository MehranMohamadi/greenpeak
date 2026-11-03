"""Bounded, daily page-access samples. No LLM calls or full-text storage."""

from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

import httpx

from .article_analysis import access_failure, fetch_article_text
from .source_config import NEWS_SOURCES

REVIEW_ID = "publisher-page-access-v1"
REVIEW_DAYS = 10
SAMPLES_PER_DAY = 3
TIMEZONE = ZoneInfo("Asia/Tehran")


def review_source_access(repository, source, documents, *, now=None, feed_error=None):
    now = now or datetime.now(UTC)
    day = now.astimezone(TIMEZONE).date()
    review = repository.start_access_review(REVIEW_ID, day.isoformat())
    start = datetime.fromisoformat(review["start_date"]).date()
    if not start <= day < start + timedelta(days=REVIEW_DAYS):
        return
    run_key = f"{REVIEW_ID}:{day}:{source}"
    if not repository.claim_run(run_key, "news_access_review"):
        return
    samples = []
    seen = set()
    for document in sorted(documents, key=lambda item: item["published_at"], reverse=True):
        url = document.get("url")
        if not url or url in seen:
            continue
        seen.add(url)
        sample = {"item_id": document["item_id"], "url": url, "checked_at": now}
        try:
            text = fetch_article_text(url)
            sample.update(status="page_text_available", http_status=200, character_count=len(text))
        except (httpx.HTTPError, ValueError) as exc:
            sample.update(access_failure(exc), character_count=0)
        samples.append(sample)
        if len(samples) >= SAMPLES_PER_DAY:
            break
    repository.finish_run(run_key, "success", {
        "review_id": REVIEW_ID, "source": source, "date": day.isoformat(),
        "feed_status": "error" if feed_error else "available" if documents else "empty",
        "feed_error": feed_error, "samples": samples,
    })


def build_access_report(review, runs, *, now=None):
    now = now or datetime.now(UTC)
    start = datetime.fromisoformat(review["start_date"]).date() if review else None
    end = start + timedelta(days=REVIEW_DAYS) if start else None
    today = now.astimezone(TIMEZONE).date()
    sources = []
    for source, label, _ in NEWS_SOURCES:
        days = [run["metrics"] for run in runs if run.get("metrics", {}).get("source") == source]
        samples = [sample for day in days for sample in day.get("samples", [])]
        counts = {}
        for sample in samples:
            counts[sample["status"]] = counts.get(sample["status"], 0) + 1
        sources.append({
            "source": source, "label": label, "sampled_days": len(days),
            "attempts": len(samples), "page_text_available": counts.get("page_text_available", 0),
            "status_counts": counts, "feed_error_days": sum(day.get("feed_status") == "error" for day in days),
            "days": sorted(days, key=lambda day: day["date"]),
        })
    return {
        "review_id": REVIEW_ID, "duration_days": REVIEW_DAYS, "samples_per_source_per_day": SAMPLES_PER_DAY,
        "start_date": start.isoformat() if start else None,
        "end_date_exclusive": end.isoformat() if end else None,
        "status": "pending" if not start else "completed" if today >= end else "active",
        "sources": sources,
    }
