"""Small MongoDB-backed username/password authentication service."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import re
import secrets
import time
from datetime import datetime, timezone
from typing import Any

from pymongo import ASCENDING, MongoClient
from pymongo.errors import DuplicateKeyError


USERNAME_PATTERN = re.compile(r"^[A-Za-z0-9_.-]{3,32}$")
PBKDF2_ITERATIONS = 600_000


class AuthError(Exception):
    """Expected authentication error safe to return to a client."""


def _b64encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _b64decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${_b64encode(salt)}${_b64encode(digest)}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        algorithm, iterations, salt, expected = encoded.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), _b64decode(salt), int(iterations))
        return hmac.compare_digest(actual, _b64decode(expected))
    except (TypeError, ValueError):
        return False


class AuthService:
    def __init__(self, collection: Any, secret_key: str, token_ttl_seconds: int = 604_800) -> None:
        self.collection = collection
        self.secret_key = secret_key.encode("utf-8")
        self.token_ttl_seconds = token_ttl_seconds

    @classmethod
    def from_settings(cls, settings: Any) -> "AuthService":
        client = MongoClient(settings.mongodb_url, serverSelectionTimeoutMS=3000)
        return cls(client[settings.mongodb_database].gp_users, settings.auth_secret_key, settings.auth_token_ttl_seconds)

    def ensure_indexes(self) -> None:
        self.collection.create_index([("username_normalized", ASCENDING)], unique=True)

    def signup(self, username: str, password: str) -> tuple[dict[str, Any], str]:
        username = username.strip()
        if not USERNAME_PATTERN.fullmatch(username):
            raise AuthError("Username must be 3-32 characters and use only letters, numbers, dot, dash, or underscore.")
        if len(password) < 6 or len(password) > 128:
            raise AuthError("Password must be between 6 and 128 characters.")

        self.ensure_indexes()
        now = datetime.now(timezone.utc)
        document = {
            "username": username,
            "username_normalized": username.casefold(),
            "password_hash": hash_password(password),
            "role": "user",
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        }
        try:
            result = self.collection.insert_one(document)
        except DuplicateKeyError as exc:
            raise AuthError("This username is already registered.") from exc
        user = {"id": str(result.inserted_id), "username": username, "role": "user"}
        return user, self.create_token(user)

    def login(self, username: str, password: str) -> tuple[dict[str, Any], str]:
        document = self.collection.find_one({"username_normalized": username.strip().casefold()})
        if not document or not document.get("is_active", True) or not verify_password(password, document.get("password_hash", "")):
            raise AuthError("Invalid username or password.")
        user = {"id": str(document["_id"]), "username": document["username"], "role": document.get("role", "user")}
        return user, self.create_token(user)

    def create_token(self, user: dict[str, Any]) -> str:
        payload = {
            "sub": user["id"],
            "username": user["username"],
            "role": user.get("role", "user"),
            "exp": int(time.time()) + self.token_ttl_seconds,
        }
        encoded = _b64encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
        signature = _b64encode(hmac.new(self.secret_key, encoded.encode("ascii"), hashlib.sha256).digest())
        return f"{encoded}.{signature}"

    def user_from_token(self, token: str) -> dict[str, Any]:
        try:
            encoded, supplied_signature = token.split(".", 1)
            expected_signature = _b64encode(hmac.new(self.secret_key, encoded.encode("ascii"), hashlib.sha256).digest())
            if not hmac.compare_digest(supplied_signature, expected_signature):
                raise AuthError("Invalid or expired session.")
            payload = json.loads(_b64decode(encoded))
            if int(payload["exp"]) < int(time.time()):
                raise AuthError("Invalid or expired session.")
        except (ValueError, KeyError, TypeError, json.JSONDecodeError) as exc:
            raise AuthError("Invalid or expired session.") from exc

        document = self.collection.find_one({"username_normalized": str(payload["username"]).casefold()})
        if not document or not document.get("is_active", True) or str(document["_id"]) != payload["sub"]:
            raise AuthError("Invalid or expired session.")
        return {"id": str(document["_id"]), "username": document["username"], "role": document.get("role", "user")}
