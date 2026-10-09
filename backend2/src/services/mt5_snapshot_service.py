"""Persistence for immutable MT5 snapshots."""

from datetime import datetime, timezone
from itertools import chain
from typing import Any

from bson import ObjectId
from pymongo.errors import DuplicateKeyError

from .mongodb_service import MongoDBService
from .mt5_connection_service import COLLECTION as CONNECTION_COLLECTION
from ..models.mt5_schemas import MT5Snapshot


COLLECTION = "gp_mt5_account_snapshots"


class MT5ConnectionUnavailableError(Exception):
    """An ingestion raced with connection revocation or broker deletion."""


def _prepare_for_response(document: dict[str, Any]) -> dict[str, Any]:
    document.pop("_id", None)
    document.pop("owner_user_id", None)
    document.pop("connection_id", None)
    # PyMongo returns BSON UTC datetimes without tzinfo unless the client is
    # configured as tz-aware. Restore the UTC marker before response validation.
    timestamp = document.get("timestamp_utc")
    if isinstance(timestamp, datetime) and timestamp.tzinfo is None:
        document["timestamp_utc"] = timestamp.replace(tzinfo=timezone.utc)
    return document


def _prepare_for_aggregation(document: dict[str, Any]) -> dict[str, Any]:
    """Keep the owner only for internal distinct-user counting."""
    document.pop("_id", None)
    document.pop("connection_id", None)
    timestamp = document.get("timestamp_utc")
    if isinstance(timestamp, datetime) and timestamp.tzinfo is None:
        document["timestamp_utc"] = timestamp.replace(tzinfo=timezone.utc)
    return document


class MT5SnapshotService:
    def __init__(self, mongodb: MongoDBService | None = None):
        self.mongodb = mongodb or MongoDBService()

    def store(self, snapshot: MT5Snapshot, owner_user_id: str, connection_id: str) -> str:
        collection = self.mongodb.get_collection(COLLECTION)
        collection.create_index("snapshot_id", unique=True)
        collection.create_index(
            [("source.account_identifier", 1), ("timestamp_utc", -1)]
        )
        collection.create_index(
            [
                ("owner_user_id", 1),
                ("source.broker_company", 1),
                ("source.trade_server", 1),
                ("source.account_identifier", 1),
                ("timestamp_utc", -1),
            ]
        )
        document = snapshot.model_dump(mode="python")
        document["owner_user_id"] = owner_user_id
        document["connection_id"] = connection_id
        document["received_at_utc"] = datetime.now(timezone.utc)
        try:
            collection.insert_one(document)
            result = "accepted"
        except DuplicateKeyError:
            result = "already_exists"
        # Broker deletion removes connections before snapshots. Checking after
        # insertion also removes an in-flight upload that arrived after deletion.
        active_connection = self.mongodb.get_collection(CONNECTION_COLLECTION).find_one({
            "_id": ObjectId(connection_id), "user_id": owner_user_id, "revoked_at": None,
        })
        if active_connection is None:
            collection.delete_many({
                "owner_user_id": owner_user_id,
                "connection_id": connection_id,
                "snapshot_id": snapshot.snapshot_id,
            })
            raise MT5ConnectionUnavailableError()
        return result

    def delete_broker(self, owner_user_id: str, broker_company: str) -> dict[str, Any]:
        """Permanently remove this user's broker history and bound pairing tokens."""
        snapshots = self.mongodb.get_collection(COLLECTION)
        connections = self.mongodb.get_collection(CONNECTION_COLLECTION)
        snapshot_query = {
            "owner_user_id": owner_user_id,
            "source.broker_company": broker_company,
        }
        connection_query = {
            "user_id": owner_user_id,
            "account_identity.broker_company": broker_company,
        }
        identities = chain(
            (item["source"] for item in snapshots.find(snapshot_query, {"source": 1, "_id": 0})),
            (item["account_identity"] for item in connections.find(connection_query, {"account_identity": 1, "_id": 0})),
        )
        accounts = {
            (item["broker_company"], item["trade_server"], item["account_identifier"]): {
                key: item[key] for key in ("broker_company", "trade_server", "account_identifier")
            }
            for item in identities
        }
        # Stop automatic uploads first; a retry can finish snapshot cleanup if
        # the second operation fails. Every query is scoped to the current user.
        deleted_connections = connections.delete_many(connection_query).deleted_count
        deleted_snapshots = snapshots.delete_many(snapshot_query).deleted_count
        return {
            "broker_company": broker_company,
            "deleted_snapshots": deleted_snapshots,
            "deleted_connections": deleted_connections,
            "deleted_accounts": list(accounts.values()),
        }

    def latest(self, owner_user_id: str, account_identifier: str | None = None) -> dict[str, Any] | None:
        query: dict[str, Any] = {"owner_user_id": owner_user_id}
        if account_identifier:
            query["source.account_identifier"] = account_identifier
        document = self.mongodb.get_collection(COLLECTION).find_one(
            query, sort=[("timestamp_utc", -1)]
        )
        if document:
            _prepare_for_response(document)
        return document

    def latest_by_account(self, owner_user_id: str) -> list[dict[str, Any]]:
        """Return the newest snapshot for each broker/server/account identity."""
        pipeline = [
            {"$match": {"owner_user_id": owner_user_id}},
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

    def all_snapshots(self, owner_user_id: str) -> list[dict[str, Any]]:
        """Return every stored snapshot, newest first, for the complete JSON view."""
        documents = self.mongodb.get_collection(COLLECTION).find(
            {"owner_user_id": owner_user_id}, sort=[("timestamp_utc", -1)]
        )
        return [_prepare_for_response(document) for document in documents]

    def latest_accounts_for_aggregation(self) -> list[dict[str, Any]]:
        """Return one current snapshot per account across users for private aggregation.

        The result is an internal service contract and intentionally retains
        ``owner_user_id`` so the comparison layer can enforce a distinct-user
        privacy threshold. It must never be returned directly by an endpoint.
        """
        pipeline = [
            {
                "$sort": {
                    "owner_user_id": 1,
                    "source.broker_company": 1,
                    "source.trade_server": 1,
                    "source.account_identifier": 1,
                    "timestamp_utc": -1,
                }
            },
            {
                "$group": {
                    "_id": {
                        "owner_user_id": "$owner_user_id",
                        "broker_company": "$source.broker_company",
                        "trade_server": "$source.trade_server",
                        "account_identifier": "$source.account_identifier",
                    },
                    "snapshot": {"$first": "$$ROOT"},
                }
            },
            {"$replaceRoot": {"newRoot": "$snapshot"}},
        ]
        documents = self.mongodb.get_collection(COLLECTION).aggregate(pipeline)
        return [_prepare_for_aggregation(document) for document in documents]
