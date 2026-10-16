"""Per-user MT5 pairing tokens and account ownership."""

from __future__ import annotations

import base64
import hashlib
import secrets
from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from pymongo import ReturnDocument

from ..core.config import get_settings
from .mongodb_service import MongoDBService


COLLECTION = "gp_mt5_connections"


class ConnectionKeyUnavailableError(Exception):
    """The original key cannot currently be revealed."""


class ConnectionKeyConfigurationError(ConnectionKeyUnavailableError):
    """The server encryption secret is not configured securely."""


def _key_cipher() -> Fernet:
    settings = get_settings()
    secret = settings.auth_secret_key
    if secret == "development-only-change-me" or len(secret) < 32:
        raise ConnectionKeyConfigurationError("Secure connection key storage is not configured")
    # Domain separation keeps encryption material distinct from session signing.
    key = HKDF(
        algorithm=hashes.SHA256(), length=32, salt=None,
        info=b"greenpeak/mt5-connection-key/v1",
    ).derive(secret.encode("utf-8"))
    return Fernet(base64.urlsafe_b64encode(key))


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
        encrypted_token = _key_cipher().encrypt(token.encode("utf-8")).decode("ascii")
        now = datetime.now(timezone.utc)
        document = {
            "user_id": user_id,
            "label": label.strip() or "MetaTrader 5",
            "token_hash": _token_hash(token),
            "encrypted_token": encrypted_token,
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

    def reveal_key(self, user_id: str, connection_id: str) -> str | None:
        try:
            object_id = ObjectId(connection_id)
        except Exception:
            return None
        document = self.collection.find_one({
            "_id": object_id, "user_id": user_id, "revoked_at": None,
        })
        if document is None:
            return None
        if not isinstance(document.get("encrypted_token"), str) or not document["encrypted_token"]:
            raise ConnectionKeyUnavailableError("Original connection key awaits an MT5 upload")
        try:
            token = _key_cipher().decrypt(document["encrypted_token"].encode("ascii")).decode("utf-8")
            if not secrets.compare_digest(_token_hash(token), document["token_hash"]):
                raise ConnectionKeyUnavailableError("Original connection key unavailable")
            return token
        except (InvalidToken, UnicodeError, ValueError) as exc:
            raise ConnectionKeyUnavailableError("Original connection key unavailable") from exc

    def resolve_and_bind(self, token: str, source: dict[str, Any]) -> dict[str, Any] | None:
        collection = self.collection
        identity = {
            "broker_company": source["broker_company"],
            "trade_server": source["trade_server"],
            "account_identifier": source["account_identifier"],
        }
        now = datetime.now(timezone.utc)
        connection = collection.find_one_and_update(
            {
                "token_hash": _token_hash(token),
                "revoked_at": None,
                "$or": [{"account_identity": None}, {"account_identity": identity}],
            },
            {"$set": {"account_identity": identity, "last_seen_at": now}},
            return_document=ReturnDocument.AFTER,
        )
        # An authenticated upload supplies the exact original key for legacy
        # hash-only records. Never rotate the key or interrupt ingestion if the
        # encryption secret is unavailable; a later upload can backfill it.
        if connection is not None:
            try:
                cipher = _key_cipher()
                encrypted = connection.get("encrypted_token")
                try:
                    current = cipher.decrypt(encrypted.encode("ascii")).decode("utf-8") if isinstance(encrypted, str) else None
                except (InvalidToken, UnicodeError, ValueError):
                    current = None
                if current != token:
                    collection.update_one(
                        {"_id": connection["_id"], "revoked_at": None, "token_hash": _token_hash(token)},
                        {"$set": {"encrypted_token": cipher.encrypt(token.encode("utf-8")).decode("ascii")}},
                    )
            except ConnectionKeyUnavailableError:
                pass
        return connection
