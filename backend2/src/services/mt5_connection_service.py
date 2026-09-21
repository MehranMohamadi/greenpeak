"""Per-user MT5 pairing tokens and account ownership."""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from pymongo import ReturnDocument

from .mongodb_service import MongoDBService


COLLECTION = "gp_mt5_connections"


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _public_connection(document: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(document["_id"]),
        "label": document.get("label", "MetaTrader 5"),
        "status": "connected" if document.get("account_identity") else "waiting_for_first_snapshot",
        "account_identity": document.get("account_identity"),
        "created_at": document["created_at"],
        "last_seen_at": document.get("last_seen_at"),
    }


class MT5ConnectionService:
    def __init__(self, mongodb: MongoDBService | None = None):
        self.mongodb = mongodb or MongoDBService()

    @property
    def collection(self):
        return self.mongodb.get_collection(COLLECTION)

    def create(self, user_id: str, label: str) -> tuple[dict[str, Any], str]:
        collection = self.collection
        collection.create_index("token_hash", unique=True)
        collection.create_index([("user_id", 1), ("created_at", -1)])
        token = f"gpmt5_{secrets.token_urlsafe(32)}"
        now = datetime.now(timezone.utc)
        document = {
            "user_id": user_id,
            "label": label.strip() or "MetaTrader 5",
            "token_hash": _token_hash(token),
            "created_at": now,
            "last_seen_at": None,
            "account_identity": None,
            "revoked_at": None,
        }
        result = collection.insert_one(document)
        document["_id"] = result.inserted_id
        return _public_connection(document), token

    def list_for_user(self, user_id: str) -> list[dict[str, Any]]:
        documents = self.collection.find({"user_id": user_id, "revoked_at": None}, sort=[("created_at", -1)])
        return [_public_connection(document) for document in documents]

    def revoke(self, user_id: str, connection_id: str) -> bool:
        try:
            object_id = ObjectId(connection_id)
        except Exception:
            return False
        result = self.collection.update_one(
            {"_id": object_id, "user_id": user_id, "revoked_at": None},
            {"$set": {"revoked_at": datetime.now(timezone.utc)}},
        )
        return result.modified_count == 1

    def resolve_and_bind(self, token: str, source: dict[str, Any]) -> dict[str, Any] | None:
        collection = self.collection
        identity = {
            "broker_company": source["broker_company"],
            "trade_server": source["trade_server"],
            "account_identifier": source["account_identifier"],
        }
        now = datetime.now(timezone.utc)
        return collection.find_one_and_update(
            {
                "token_hash": _token_hash(token),
                "revoked_at": None,
                "$or": [{"account_identity": None}, {"account_identity": identity}],
            },
            {"$set": {"account_identity": identity, "last_seen_at": now}},
            return_document=ReturnDocument.AFTER,
        )
