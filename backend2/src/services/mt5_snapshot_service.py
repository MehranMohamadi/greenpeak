"""Persistence for immutable MT5 snapshots."""

from datetime import datetime, timezone
from typing import Any

from pymongo.errors import DuplicateKeyError

from .mongodb_service import MongoDBService
from ..models.mt5_schemas import MT5Snapshot


COLLECTION = "gp_mt5_account_snapshots"


def _prepare_for_response(document: dict[str, Any]) -> dict[str, Any]:
    document.pop("_id", None)
    # PyMongo returns BSON UTC datetimes without tzinfo unless the client is
    # configured as tz-aware. Restore the UTC marker before response validation.
    timestamp = document.get("timestamp_utc")
    if isinstance(timestamp, datetime) and timestamp.tzinfo is None:
        document["timestamp_utc"] = timestamp.replace(tzinfo=timezone.utc)
    return document


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
            _prepare_for_response(document)
        return document

    def latest_by_account(self) -> list[dict[str, Any]]:
        """Return the newest snapshot for each broker/server/account identity."""
        pipeline = [
            {"$sort": {"timestamp_utc": -1}},
            {
                "$group": {
                    "_id": {
                        "broker_company": "$source.broker_company",
                        "trade_server": "$source.trade_server",
                        "account_identifier": "$source.account_identifier",
                    },
                    "snapshot": {"$first": "$$ROOT"},
                }
            },
            {"$replaceRoot": {"newRoot": "$snapshot"}},
            {
                "$sort": {
                    "source.broker_company": 1,
                    "source.trade_server": 1,
                    "source.account_identifier": 1,
                }
            },
        ]
        documents = self.mongodb.get_collection(COLLECTION).aggregate(pipeline)
        return [_prepare_for_response(document) for document in documents]
