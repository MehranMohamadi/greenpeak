"""Small MongoDB-backed username/password authentication service."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import re
import secrets
import sqlite3
import time
from types import SimpleNamespace
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from bson import ObjectId
from bson.errors import InvalidId
from pymongo import ASCENDING, MongoClient
from pymongo.errors import DuplicateKeyError, PyMongoError


USERNAME_PATTERN = re.compile(r"^[A-Za-z0-9_.-]{3,32}$")
PBKDF2_ITERATIONS = 600_000
ACTIVITY_WRITE_INTERVAL_SECONDS = 60


def _activity_instant(value):
    """MongoDB returns naive UTC datetimes; SQLite stores ISO timestamps."""
    if value is None:
        return None
    if isinstance(value, str):
        value = datetime.fromisoformat(value)
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


class AuthError(Exception):
    """Expected authentication error safe to return to a client."""


class AuthStorageError(Exception):
    """Authentication storage failed in a way that is safe to map to HTTP 503."""


class _LocalInsertResult:
    def __init__(self, inserted_id: int) -> None:
        self.inserted_id = inserted_id


class LocalUserCollection:
    """Small SQLite-backed user store used only as a development fallback."""

    def __init__(self, database_path: str | Path) -> None:
        self.database_path = Path(database_path)
        try:
            self.database_path.parent.mkdir(parents=True, exist_ok=True)
            self._initialize()
        except (OSError, sqlite3.Error) as exc:
            raise AuthStorageError("Local authentication database is unavailable.") from exc

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.database_path, timeout=5)
        connection.row_factory = sqlite3.Row
        return connection

    def _initialize(self) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS gp_users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT NOT NULL,
                    username_normalized TEXT NOT NULL UNIQUE,
                    password_hash TEXT NOT NULL,
                    role TEXT NOT NULL DEFAULT 'user',
                    is_active INTEGER NOT NULL DEFAULT 1,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    is_local_test_user INTEGER NOT NULL DEFAULT 0
                )
                """
            )
            columns = {row[1] for row in connection.execute("PRAGMA table_info(gp_users)")}
            if "extra_json" not in columns:
                connection.execute("ALTER TABLE gp_users ADD COLUMN extra_json TEXT NOT NULL DEFAULT '{}'")
            for field in ("email_normalized",):
                connection.execute(f"CREATE UNIQUE INDEX IF NOT EXISTS gp_users_{field} ON gp_users(json_extract(extra_json, '$.{field}'))")

    def create_index(self, *_args: Any, **_kwargs: Any) -> str:
        # The SQLite schema already enforces the same unique normalized username.
        return "username_normalized_1"

    def insert_one(self, document: dict[str, Any]) -> _LocalInsertResult:
        try:
            with self._connect() as connection:
                cursor = connection.execute(
                    """
                    INSERT INTO gp_users (
                        username, username_normalized, password_hash, role,
                        is_active, created_at, updated_at, is_local_test_user, extra_json
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        document["username"],
                        document["username_normalized"],
                        document["password_hash"],
                        document.get("role", "user"),
                        int(document.get("is_active", True)),
                        self._serialize_datetime(document.get("created_at")),
                        self._serialize_datetime(document.get("updated_at")),
                        int(document.get("is_local_test_user", False)),
                        json.dumps(document, default=str),
                    ),
                )
                return _LocalInsertResult(int(cursor.lastrowid))
        except sqlite3.IntegrityError as exc:
            raise DuplicateKeyError("duplicate username") from exc
        except (KeyError, TypeError, ValueError, sqlite3.Error) as exc:
            raise AuthStorageError("Local authentication database is unavailable.") from exc

    def find_one(self, query: dict[str, Any]) -> dict[str, Any] | None:
        try:
            with self._connect() as connection:
                for row in connection.execute("SELECT * FROM gp_users"):
                    document = self._document(row)
                    if self._matches(document, query):
                        return document
        except sqlite3.Error as exc:
            raise AuthStorageError("Local authentication database is unavailable.") from exc
        return None

    def find(self, query, projection=None):
        try:
            with self._connect() as connection:
                documents = [self._document(row) for row in connection.execute("SELECT * FROM gp_users")]
            matches = [document for document in documents if self._matches(document, query)]
            if projection:
                matches = [{key: document[key] for key, included in projection.items() if included and key in document} for document in matches]
            return matches
        except sqlite3.Error as exc:
            raise AuthStorageError("Local authentication database is unavailable.") from exc

    @staticmethod
    def _document(row):
        document = dict(row)
        document.update(json.loads(document.pop("extra_json", "{}")))
        document["_id"] = document.pop("id")
        document["is_active"] = bool(document["is_active"])
        document["is_local_test_user"] = bool(document["is_local_test_user"])
        return document

    @staticmethod
    def _matches(document, query):
        return all(document.get(key) == value for key, value in query.items())

    def update_one(self, query, update):
        try:
            with self._connect() as connection:
                connection.execute("BEGIN IMMEDIATE")
                for row in connection.execute("SELECT * FROM gp_users").fetchall():
                    document = self._document(row)
                    if not self._matches(document, query):
                        continue
                    document.update(update.get("$set", {}))
                    for key in update.get("$unset", {}):
                        document.pop(key, None)
                    for key, amount in update.get("$inc", {}).items():
                        document[key] = document.get(key, 0) + amount
                    connection.execute(
                        "UPDATE gp_users SET password_hash = ?, role = ?, extra_json = ? WHERE id = ?",
                        (document["password_hash"], document["role"], json.dumps(document, default=str), document["_id"]),
                    )
                    return SimpleNamespace(modified_count=1)
                return SimpleNamespace(modified_count=0)
        except sqlite3.IntegrityError as exc:
            raise DuplicateKeyError("duplicate identity") from exc
        except sqlite3.Error as exc:
            raise AuthStorageError("Local authentication database is unavailable.") from exc

    @staticmethod
    def _serialize_datetime(value: Any) -> str:
        if isinstance(value, datetime):
            return value.isoformat()
        if value is None:
            return datetime.now(timezone.utc).isoformat()
        return str(value)


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
        if settings.environment != "development" and (settings.auth_secret_key == "development-only-change-me" or len(settings.auth_secret_key) < 32):
            raise AuthStorageError("A strong authentication secret is required.")
        if settings.environment == "development" and settings.auth_local_fallback_enabled:
            client = None
            try:
                client = MongoClient(settings.mongodb_url, serverSelectionTimeoutMS=3000)
                client.admin.command("ping")
            except PyMongoError:
                if client is not None:
                    client.close()
                collection = LocalUserCollection(settings.auth_local_db_path)
                return cls(collection, settings.auth_secret_key, settings.auth_token_ttl_seconds)
        else:
            client = MongoClient(settings.mongodb_url, serverSelectionTimeoutMS=3000)
        return cls(client[settings.mongodb_database].gp_users, settings.auth_secret_key, settings.auth_token_ttl_seconds)

    def ensure_indexes(self) -> None:
        self.collection.create_index([("username_normalized", ASCENDING)], unique=True)
        for field in ("email_normalized",):
            self.collection.create_index([(field, ASCENDING)], unique=True, partialFilterExpression={field: {"$type": "string"}})

    def list_admins(self):
        return self.list_users(role="admin")

    def list_users(self, role=None):
        projection = {"_id": 1, "username": 1, "role": 1, "is_active": 1, "created_at": 1, "can_view_premium_analysis": 1, "last_active_at": 1}
        return sorted([
            {"id": str(row["_id"]), "username": row["username"], "role": row.get("role", "user"),
             "is_active": row.get("is_active", True), "created_at": row.get("created_at"),
             "last_active_at": _activity_instant(row.get("last_active_at")),
             "can_view_premium_analysis": row.get("can_view_premium_analysis") is True}
            for row in self.collection.find({"role": role, "deleted_at": None} if role else {"deleted_at": None}, projection)
        ], key=lambda row: row["username"].casefold())

    def promote_user_to_admin(self, user_id: str, actor_id: str):
        try:
            identifier = int(user_id) if isinstance(self.collection, LocalUserCollection) else ObjectId(user_id)
        except (ValueError, InvalidId):
            return None
        document = self.collection.find_one({"_id": identifier})
        if not document or document.get("deleted_at"):
            return None
        if document.get("role") != "admin":
            now = datetime.now(timezone.utc)
            self.collection.update_one({"_id": identifier}, {"$set": {
                "role": "admin", "updated_at": now,
                "role_promoted_at": now, "role_promoted_by": actor_id,
            }})
        # Re-read so a concurrent deletion cannot report a successful promotion.
        document = self.collection.find_one({"_id": identifier})
        if not document:
            return None
        return {"id": str(document["_id"]), "username": document["username"], "role": document["role"]}

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
        user = {"id": str(result.inserted_id), "username": username, "role": "user", "can_view_premium_analysis": False}
        return user, self.create_token(user)

    def login(self, username: str, password: str) -> tuple[dict[str, Any], str]:
        field = "email_normalized" if "@" in username else "username_normalized"
        document = self.collection.find_one({field: username.strip().casefold()})
        if not document or not document.get("is_active", True) or not verify_password(password, document.get("password_hash", "")):
            raise AuthError("Invalid username or password.")
        if document.get("email_verified") is False:
            raise AuthError("Please verify your email before signing in.")
        self._record_activity(document)
        user = {"id": str(document["_id"]), "username": document["username"], "role": document.get("role", "user"),
                "can_view_premium_analysis": document.get("can_view_premium_analysis") is True}
        return user, self.create_token({**user, "session_version": document.get("session_version", 0)})

    def change_password(self, username: str, current_password: str, new_password: str) -> None:
        normalized_username = username.strip().casefold()
        document = self.collection.find_one({"username_normalized": normalized_username})
        if not document or not document.get("is_active", True):
            raise AuthError("Account not found.")
        if not verify_password(current_password, document.get("password_hash", "")):
            raise AuthError("Current password is incorrect.")
        if len(new_password) < 8 or len(new_password) > 128:
            raise AuthError("New password must be between 8 and 128 characters.")
        if verify_password(new_password, document.get("password_hash", "")):
            raise AuthError("Choose a password different from your current password.")

        result = self.collection.update_one(
            {"_id": document["_id"]},
            {"$set": {"password_hash": hash_password(new_password), "updated_at": datetime.now(timezone.utc)}},
        )
        if not result.modified_count:
            raise AuthStorageError("Password could not be updated.")

    def ensure_test_user(self, username: str, password: str) -> None:
        """Create the local-only test account once without resetting its password."""
        normalized = username.casefold()
        if self.collection.find_one({"username_normalized": normalized}):
            return
        self.ensure_indexes()
        now = datetime.now(timezone.utc)
        try:
            self.collection.insert_one(
                {
                    "username": username,
                    "username_normalized": normalized,
                    "password_hash": hash_password(password),
                    "role": "user",
                    "is_active": True,
                    "created_at": now,
                    "updated_at": now,
                    "is_local_test_user": True,
                }
            )
        except DuplicateKeyError:
            # Another local request initialized the same account first.
            return

    def create_token(self, user: dict[str, Any]) -> str:
        payload = {
            "sub": user["id"],
            "username": user["username"],
            "role": user.get("role", "user"),
            "exp": int(time.time()) + self.token_ttl_seconds,
            "ver": user.get("session_version", 0),
        }
        encoded = _b64encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
        signature = _b64encode(hmac.new(self.secret_key, encoded.encode("ascii"), hashlib.sha256).digest())
        return f"{encoded}.{signature}"

    def _record_activity(self, document):
        """Record server time, with one write per minute across tabs/workers."""
        now = datetime.now(timezone.utc)
        previous = document.get("last_active_at")
        instant = _activity_instant(previous)
        if instant is not None and (now - instant).total_seconds() < ACTIVITY_WRITE_INTERVAL_SECONDS:
            return
        # Compare the stored value so an older concurrent request cannot regress it.
        self.collection.update_one(
            {"_id": document["_id"], "last_active_at": previous},
            {"$set": {"last_active_at": now}},
        )

    def user_from_token(self, token: str, *, record_activity: bool = False) -> dict[str, Any]:
        try:
            encoded, supplied_signature = token.split(".", 1)
            expected_signature = _b64encode(hmac.new(self.secret_key, encoded.encode("ascii"), hashlib.sha256).digest())
            if not hmac.compare_digest(supplied_signature, expected_signature):
                raise AuthError("Invalid or expired session.")
            payload = json.loads(_b64decode(encoded))
            if int(payload["exp"]) <= int(time.time()):
                raise AuthError("Invalid or expired session.")
        except (ValueError, KeyError, TypeError, json.JSONDecodeError) as exc:
            raise AuthError("Invalid or expired session.") from exc

        document = self.collection.find_one({"username_normalized": str(payload["username"]).casefold()})
        if (not document or not document.get("is_active", True) or str(document["_id"]) != payload["sub"]
                or document.get("email_verified") is False
                or document.get("session_version", 0) != payload.get("ver", 0)):
            raise AuthError("Invalid or expired session.")
        if record_activity:
            self._record_activity(document)
        return {"id": str(document["_id"]), "username": document["username"], "role": document.get("role", "user"),
                "can_view_premium_analysis": document.get("can_view_premium_analysis") is True}

    def set_premium_analysis(self, user_id, enabled, actor_id):
        try:
            identifier = int(user_id) if isinstance(self.collection, LocalUserCollection) else ObjectId(user_id)
        except (ValueError, InvalidId):
            return None
        self.collection.update_one({"_id": identifier, "deleted_at": None}, {"$set": {
            "can_view_premium_analysis": enabled,
            "analysis_access_changed_at": datetime.now(timezone.utc),
            "analysis_access_changed_by": actor_id,
        }})
        document = self.collection.find_one({"_id": identifier, "deleted_at": None})
        if not document:
            return None
        return {"id": str(document["_id"]), "username": document["username"],
                "role": document.get("role", "user"),
                "can_view_premium_analysis": document.get("can_view_premium_analysis") is True}

    def set_staff_role(self, user_id, role, actor):
        """Staff assignment cannot change an administrator or premium access."""
        from .auth_admin import AccountManagementError
        if role not in {"user", "staff"}:
            raise AccountManagementError("Invalid staff role.", 422)
        try:
            identifier = int(user_id) if isinstance(self.collection, LocalUserCollection) else ObjectId(user_id)
        except (ValueError, InvalidId):
            raise AccountManagementError("User not found.", 404)
        document = self.collection.find_one({"_id": identifier, "deleted_at": None})
        if not document or not document.get("is_active", True):
            raise AccountManagementError("Active user not found.", 404)
        if document.get("role") == "admin":
            raise AccountManagementError("Staff assignment cannot change an administrator.")
        if document.get("role", "user") == role:
            return {"id": str(document["_id"]), "username": document["username"], "role": role,
                    "can_view_premium_analysis": document.get("can_view_premium_analysis") is True}
        now = datetime.now(timezone.utc)
        result = self.collection.update_one(
            {"_id": identifier, "role": document.get("role"), "deleted_at": None},
            {"$set": {"role": role, "role_changed_at": now, "updated_at": now,
                      "role_changed_by": actor["id"], "role_changed_by_username": actor["username"]}})
        if not result.modified_count:
            raise AccountManagementError("Account changed concurrently. Refresh and try again.")
        return {"id": str(document["_id"]), "username": document["username"], "role": role,
                "can_view_premium_analysis": document.get("can_view_premium_analysis") is True}
