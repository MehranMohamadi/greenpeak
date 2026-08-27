"""Persistence for immutable MT5 snapshots."""

from datetime import datetime, timezone
from typing import Any

from pymongo.errors import DuplicateKeyError

from .mongodb_service import MongoDBService
from ..models.mt5_schemas import MT5Snapshot


COLLECTION = "gp_mt5_account_snapshots"


class MT5SnapshotService:
    def __init__(self, mongodb: MongoDBService | None = None):
        self.mongodb = mongodb or MongoDBService()

    def store(self, snapshot: MT5Snapshot) -> str:
        collection = self.mongodb.get_collection(COLLECTION)
        collection.create_index("snapshot_id", unique=True)
        collection.create_index(
            [("source.account_identifier", 1), ("timestamp_utc", -1)]
        )
        document = snapshot.model_dump(mode="python")
        document["received_at_utc"] = datetime.now(timezone.utc)
        try:
            collection.insert_one(document)
            return "accepted"
        except DuplicateKeyError:
            return "already_exists"

    def latest(self, account_identifier: str | None = None) -> dict[str, Any] | None:
        query = {"source.account_identifier": account_identifier} if account_identifier else {}
        document = self.mongodb.get_collection(COLLECTION).find_one(
            query, sort=[("timestamp_utc", -1)]
        )
        if document:
            document.pop("_id", None)
        return document
