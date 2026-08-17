"""MongoDB boundaries for raw observations, snapshots, definitions, and runs."""

from datetime import date
from typing import Any

from pymongo import ASCENDING, DESCENDING, MongoClient

from .cleaning import adapt_mongo_documents


class MongoFeatureRepository:
    def __init__(self, client: MongoClient, database_name: str) -> None:
        self.db = client[database_name]

    def ensure_indexes(self) -> None:
        self.db.gp_indicator_definitions.create_index([("indicator_id", ASCENDING), ("definition_version", ASCENDING)], unique=True)
        self.db.gp_indicator_feature_snapshots.create_index(
            [("indicator_id", ASCENDING), ("as_of_date", ASCENDING), ("feature_version", ASCENDING), ("definition_version", ASCENDING)], unique=True
        )
        self.db.gp_indicator_feature_snapshots.create_index([("indicator_id", ASCENDING), ("as_of_date", DESCENDING), ("calculated_at", DESCENDING)])
        self.db.gp_feature_runs.create_index("run_id", unique=True)
        self.db.gp_feature_runs.create_index([("started_at", DESCENDING)])

    def load_observations(self, definition: dict, as_of_date: date):
        documents = self.load_raw_documents(definition, as_of_date)
        return adapt_mongo_documents(documents, definition["indicator_id"])

    def load_raw_documents(self, definition: dict, as_of_date: date) -> list[dict[str, Any]]:
        query = {"indicator": definition["raw_indicator"], "date": {"$lte": as_of_date.isoformat()}}
        return list(self.db.monetary_policy.find(query).sort([("date", ASCENDING), ("updated_at", ASCENDING)]))

    def save_definition(self, definition: dict) -> None:
        identity = {"indicator_id": definition["indicator_id"], "definition_version": definition["definition_version"]}
        self.db.gp_indicator_definitions.replace_one(identity, definition, upsert=True)

    def save_snapshot(self, snapshot: dict[str, Any]) -> str:
        identity = {key: snapshot[key] for key in ("indicator_id", "as_of_date", "feature_version", "definition_version")}
        existing = self.db.gp_indicator_feature_snapshots.find_one(identity)
        if existing:
            old_provenance = existing.get("provenance", {})
            new_provenance = snapshot.get("provenance", {})
            if old_provenance.get("config_hash") != new_provenance.get("config_hash") or old_provenance.get("code_version") != new_provenance.get("code_version"):
                return "version_conflict"
            return "already_exists"
        self.db.gp_indicator_feature_snapshots.insert_one(snapshot)
        return "inserted"

    def save_run(self, run: dict[str, Any]) -> None:
        self.db.gp_feature_runs.insert_one(run)

    def latest_snapshot(self, indicator_id: str) -> dict[str, Any] | None:
        return self.db.gp_indicator_feature_snapshots.find_one(
            {"indicator_id": indicator_id}, sort=[("as_of_date", DESCENDING), ("calculated_at", DESCENDING)], projection={"_id": False}
        )

    def snapshot_for_as_of(self, indicator_id: str, as_of_date: date) -> dict[str, Any] | None:
        return self.db.gp_indicator_feature_snapshots.find_one(
            {"indicator_id": indicator_id, "as_of_date": as_of_date.isoformat()}, sort=[("calculated_at", DESCENDING)], projection={"_id": False}
        )
