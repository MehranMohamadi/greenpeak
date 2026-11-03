import os
from copy import deepcopy
from datetime import UTC, datetime, timedelta
from urllib.parse import parse_qs, urlsplit

os.environ["DEBUG"] = "false"

import httpx
from pymongo.errors import DuplicateKeyError

from src.core.config import get_settings
from src.services.news.cnbc import fetch_cnbc_sections
from src.services.news.feed import build_source_feed, stable_item_id
from src.services.news.repository import MongoNewsRepository
from src.services.news.schemas import RawNewsItem

NOW = datetime(2026, 11, 3, 12, tzinfo=UTC)


def item(number, *, query="", guid=None):
    return RawNewsItem(
        source="cnbc_rss", source_item_id=guid or str(number),
        url=f"https://www.cnbc.com/2026/11/03/story-{number}.html{query}",
        title=f"Market news {number}", published_at=NOW - timedelta(minutes=number), fetched_at=NOW,
    )


def test_workbook_feeds_are_merged_and_overlapping_articles_keep_all_sections():
    called = []
    original = item(1)

    def fetch(url, source):
        identifier = parse_qs(urlsplit(url).query)["id"][0]
        called.append(identifier)
        assert source == "cnbc_rss"
        return {
            "20910258": [original, item(3)],
            "15839135": [item(2)],
            "100003114": [item(1, query="?__source=rss", guid="other-guid"), item(2)],
            "10000664": [item(4)],
        }[identifier]

    items, results = fetch_cnbc_sections(get_settings(), fetcher=fetch)
    assert called == ["20910258", "15839135", "100003114", "10000664"]
    assert [value.title for value in items] == [f"Market news {number}" for number in range(1, 5)]
    assert items[0].sections == ["economy", "us_top_news"]
    assert items[1].sections == ["earnings", "us_top_news"]
    assert stable_item_id(items[0]) == stable_item_id(original)
    assert original.sections == []
    assert all(value["status"] == "available" for value in results.values())


def test_one_failed_section_keeps_other_feeds_and_sanitizes_errors():
    def fetch(url, source):
        if "15839135" in url:
            raise httpx.ConnectError("private connection information")
        return [item(1)]

    items, results = fetch_cnbc_sections(get_settings(), fetcher=fetch)
    assert len(items) == 1
    assert items[0].sections == ["economy", "us_top_news", "finance"]
    assert results["earnings"] == {"status": "error", "error_code": "ConnectError", "received": 0}
    assert "private" not in str(results)


def test_cnbc_feed_deduplicates_legacy_urls_and_exposes_section_labels():
    old = {**item(1).model_dump(mode="python"), "item_id": "old", "sections": ["economy"]}
    other = {**item(1, query="?utm_source=feed").model_dump(mode="python"), "item_id": "new", "sections": ["finance"]}
    feed = build_source_feed("cnbc_rss", [old, other], 20)
    assert feed["available_count"] == feed["count"] == 1
    assert feed["items"][0]["item_id"] == "old"
    assert feed["items"][0]["sections"] == ["economy", "finance"]
    assert [section["id"] for section in feed["coverage_sections"]] == ["economy", "earnings", "us_top_news", "finance"]
    assert feed["coverage_sections"][-1]["role"] == "supplement"
    assert feed["items"][0]["source_score"] is None


def test_membership_updates_do_not_rewrite_existing_raw_news():
    original = {**item(1).model_dump(mode="python"), "item_id": "existing"}

    class RawCollection:
        def insert_one(self, document):
            raise DuplicateKeyError("exists")

    class MembershipCollection:
        def __init__(self):
            self.sections = []

        def update_one(self, query, update, upsert):
            assert query == {"_id": "existing"} and upsert
            self.sections = list(dict.fromkeys([*self.sections, *update["$addToSet"]["sections"]["$each"]]))

    memberships = MembershipCollection()
    db = type("Database", (), {"gp_news_raw": RawCollection(), "gp_news_item_sections": memberships})()
    repository = MongoNewsRepository.__new__(MongoNewsRepository)
    repository.db = db
    before = deepcopy(original)
    assert repository.save_raw([{**original, "sections": ["economy", "earnings"]}]) == 0
    assert repository.save_raw([{**original, "sections": ["earnings", "finance"]}]) == 0
    assert memberships.sections == ["economy", "earnings", "finance"]
    assert original == before
