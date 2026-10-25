"""Use the authentication database, including its explicit SQLite dev fallback.

Session times, requests, activities and their audit trail share one document.
Employee mutations are serialized across workers. Mongo runs on standalone
servers too; no cross-document transaction support is required.
"""

import json
import secrets
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone

from pymongo import ASCENDING, ReturnDocument
from pymongo.errors import DuplicateKeyError

from .auth import LocalUserCollection


class WorkplaceError(Exception):
    def __init__(self, message, status_code=409):
        super().__init__(message)
        self.status_code = status_code


class WorkplaceRepository:
    def __init__(self, users):
        self.users = users
        self.local = isinstance(users, LocalUserCollection)
        if self.local:
            with users._connect() as connection:
                connection.execute("""CREATE TABLE IF NOT EXISTS gp_work_sessions (
                    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, payload TEXT NOT NULL)""")
                connection.execute("CREATE INDEX IF NOT EXISTS gp_work_sessions_owner ON gp_work_sessions(user_id)")
        else:
            self.sessions = users.database.gp_work_sessions
            self.locks = users.database.gp_workplace_locks
            self.sessions.create_index([("user_id", ASCENDING), ("check_in", ASCENDING)])
            self.sessions.create_index([("user_id", ASCENDING)], unique=True,
                                       partialFilterExpression={"check_out": None}, name="one_open_session_per_employee")

    @contextmanager
    def employee(self, user_id):
        if self.local:
            with self.users._connect() as connection:
                connection.execute("BEGIN IMMEDIATE")
                yield LocalEmployee(connection, user_id)
            return
        owner = secrets.token_hex(16)
        now = datetime.now(timezone.utc)
        try:
            lock = self.locks.find_one_and_update(
                {"_id": user_id, "expires_at": {"$lte": now}},
                {"$set": {"owner": owner, "expires_at": now + timedelta(minutes=2)}},
                upsert=True, return_document=ReturnDocument.AFTER,
            )
        except DuplicateKeyError as exc:
            raise WorkplaceError("تغییر دیگری در حال ثبت است؛ دوباره تلاش کنید.") from exc
        if not lock or lock.get("owner") != owner:
            raise WorkplaceError("تغییر دیگری در حال ثبت است؛ دوباره تلاش کنید.")
        try:
            yield MongoEmployee(self.sessions, self.locks, user_id, owner)
        finally:
            self.locks.delete_one({"_id": user_id, "owner": owner})

    def all_sessions(self, user_id=None):
        if self.local:
            with self.users._connect() as connection:
                query = "SELECT payload FROM gp_work_sessions"
                rows = connection.execute(query + " WHERE user_id = ?", (user_id,)) if user_id else connection.execute(query)
                return [json.loads(row[0]) for row in rows]
        return [self._public(row) for row in self.sessions.find({"user_id": user_id} if user_id else {})]

    def get(self, session_id):
        if self.local:
            with self.users._connect() as connection:
                row = connection.execute("SELECT payload FROM gp_work_sessions WHERE id = ?", (session_id,)).fetchone()
                return json.loads(row[0]) if row else None
        row = self.sessions.find_one({"_id": session_id})
        return self._public(row) if row else None

    @staticmethod
    def _public(row):
        return {key: value for key, value in row.items() if key != "_id"}


class LocalEmployee:
    def __init__(self, connection, user_id):
        self.connection, self.user_id = connection, user_id

    def all(self):
        return [json.loads(row[0]) for row in self.connection.execute(
            "SELECT payload FROM gp_work_sessions WHERE user_id = ?", (self.user_id,))]

    def save(self, document, previous_revision=None):
        if previous_revision is None:
            self.connection.execute("INSERT INTO gp_work_sessions VALUES (?, ?, ?)",
                                    (document["id"], self.user_id, json.dumps(document)))
        else:
            result = self.connection.execute(
                "UPDATE gp_work_sessions SET payload = ? WHERE id = ? AND user_id = ? AND json_extract(payload, '$.revision') = ?",
                (json.dumps(document), document["id"], self.user_id, previous_revision))
            if result.rowcount != 1:
                raise WorkplaceError("اطلاعات تغییر کرده است؛ صفحه را تازه‌سازی کنید.")


class MongoEmployee:
    def __init__(self, sessions, locks, user_id, owner):
        self.sessions, self.locks, self.user_id, self.owner = sessions, locks, user_id, owner

    def all(self):
        return [WorkplaceRepository._public(row) for row in self.sessions.find({"user_id": self.user_id})]

    def save(self, document, previous_revision=None):
        if not self.locks.find_one({"_id": self.user_id, "owner": self.owner,
                                    "expires_at": {"$gt": datetime.now(timezone.utc)}}):
            raise WorkplaceError("مهلت ثبت تغییر تمام شد؛ دوباره تلاش کنید.")
        try:
            if previous_revision is None:
                self.sessions.insert_one({"_id": document["id"], **document})
            else:
                result = self.sessions.replace_one(
                    {"_id": document["id"], "user_id": self.user_id, "revision": previous_revision},
                    {"_id": document["id"], **document})
                if result.matched_count != 1:
                    raise WorkplaceError("اطلاعات تغییر کرده است؛ صفحه را تازه‌سازی کنید.")
        except DuplicateKeyError as exc:
            raise WorkplaceError("یک بازه حضور باز وجود دارد؛ ابتدا خروج را ثبت کنید.") from exc
