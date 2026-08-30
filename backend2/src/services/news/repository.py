from datetime import UTC, datetime

from pymongo import ASCENDING, DESCENDING
from pymongo.errors import DuplicateKeyError


class MongoNewsRepository:
    def __init__(self, client, database: str): self.db = client[database]

    def ensure_indexes(self):
        self.db.gp_news_raw.create_index([("item_id", ASCENDING)], unique=True)
        self.db.gp_news_raw.create_index([("source", ASCENDING), ("published_at", DESCENDING)])
        self.db.gp_news_runs.create_index([("run_key", ASCENDING)], unique=True)

    def save_raw(self, documents: list[dict]) -> int:
        written = 0
        for document in documents:
            try: self.db.gp_news_raw.insert_one(document); written += 1
            except DuplicateKeyError: pass
        return written

    def recent_raw(self, since: datetime) -> list[dict]:
        return list(self.db.gp_news_raw.find({"published_at": {"$gte": since}}, {"_id": False}))

    def source_raw(self, source: str, since: datetime, limit: int = 500) -> list[dict]:
        return list(self.db.gp_news_raw.find(
            {"source": source, "published_at": {"$gte": since}}, {"_id": False}
        ).sort("published_at", DESCENDING).limit(limit))

    def claim_run(self, run_key: str, kind: str) -> bool:
        try:
            self.db.gp_news_runs.insert_one({"run_key": run_key, "kind": kind, "status": "running", "attempt": 1, "started_at": datetime.now(UTC)})
            return True
        except DuplicateKeyError:
            # A failed run may be retried, while success/running runs remain idempotent.
            result = self.db.gp_news_runs.update_one(
                {"run_key": run_key, "status": "failed"},
                {"$set": {"status": "running", "started_at": datetime.now(UTC)}, "$inc": {"attempt": 1}, "$unset": {"finished_at": "", "error_code": ""}},
            )
            return result.modified_count == 1

    def finish_run(self, run_key: str, status: str, metrics: dict, error_code: str | None = None):
        update = {"status": status, "finished_at": datetime.now(UTC), "metrics": metrics}
        if error_code: update["error_code"] = error_code
        self.db.gp_news_runs.update_one({"run_key": run_key}, {"$set": update})
