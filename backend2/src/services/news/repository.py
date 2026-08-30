from datetime import UTC, datetime

from pymongo import ASCENDING, DESCENDING
from pymongo.errors import DuplicateKeyError


class MongoNewsRepository:
    def __init__(self, client, database: str): self.db = client[database]

    def ensure_indexes(self):
        self.db.gp_news_raw.create_index([("item_id", ASCENDING)], unique=True)
        self.db.gp_news_runs.create_index([("run_key", ASCENDING)], unique=True)
        self.db.gp_news_daily.create_index([("qualified_at", DESCENDING)])
        self.db.gp_news_explanations.create_index([("cluster_id", ASCENDING)], unique=True)

    def save_raw(self, documents: list[dict]) -> int:
        written = 0
        for document in documents:
            try: self.db.gp_news_raw.insert_one(document); written += 1
            except DuplicateKeyError: pass
        return written

    def recent_raw(self, since: datetime) -> list[dict]:
        return list(self.db.gp_news_raw.find({"published_at": {"$gte": since}}, {"_id": False}))

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

    def save_daily(self, document: dict): self.db.gp_news_daily.replace_one({"run_key": document["run_key"]}, document, upsert=True)
    def latest_daily(self): return self.db.gp_news_daily.find_one({}, {"_id": False}, sort=[("qualified_at", DESCENDING)])
    def coverage_runs(self, since: datetime) -> list[dict]:
        return list(self.db.gp_news_runs.find(
            {"kind": "qualified", "finished_at": {"$gte": since}, "status": {"$in": ["success", "partial"]}},
            {"_id": False, "run_key": True, "status": True, "finished_at": True, "metrics": True},
        ).sort("finished_at", DESCENDING))
    def explanation(self, cluster_id: str): return self.db.gp_news_explanations.find_one({"cluster_id": cluster_id}, {"_id": False})
    def save_explanation(self, document: dict): self.db.gp_news_explanations.update_one({"cluster_id": document["cluster_id"]}, {"$setOnInsert": document}, upsert=True)
