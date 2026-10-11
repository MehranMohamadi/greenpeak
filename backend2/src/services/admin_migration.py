"""Explicit, resumable one-time promotion. Never run during signup or login.

Run from backend2: python -m src.services.admin_migration
Each store records the exact existing IDs before changing roles. Re-running
cannot promote accounts registered after the first execution.
"""

import json
from datetime import UTC, datetime

from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError, PyMongoError

from ..core.config import get_settings
from .auth import LocalUserCollection

MIGRATION_ID = "existing-users-admin-v1"


def promote_local(collection):
    with collection._connect() as connection:
        connection.execute("BEGIN IMMEDIATE")
        connection.execute("CREATE TABLE IF NOT EXISTS gp_auth_migrations (id TEXT PRIMARY KEY, completed_at TEXT NOT NULL, users_json TEXT NOT NULL)")
        previous = connection.execute("SELECT users_json FROM gp_auth_migrations WHERE id=?", (MIGRATION_ID,)).fetchone()
        if previous:
            return {"status": "already_completed", "accounts": len(json.loads(previous[0]))}
        rows = connection.execute("SELECT * FROM gp_users").fetchall()
        identities = []
        for row in rows:
            document = collection._document(row)
            identities.append({"id": document["_id"], "previous_role": document.get("role", "user")})
            document["role"] = "admin"
            document["updated_at"] = datetime.now(UTC).isoformat()
            connection.execute("UPDATE gp_users SET role='admin', extra_json=? WHERE id=?", (json.dumps(document, default=str), document["_id"]))
        connection.execute("INSERT INTO gp_auth_migrations VALUES (?, ?, ?)", (MIGRATION_ID, datetime.now(UTC).isoformat(), json.dumps(identities)))
        return {"status": "completed", "accounts": len(identities)}


def promote_mongo(database):
    migrations = database.gp_auth_migrations
    migration = migrations.find_one({"_id": MIGRATION_ID})
    if migration is None:
        migration = {"_id": MIGRATION_ID, "created_at": datetime.now(UTC),
                     "users": list(database.gp_users.find({}, {"_id": 1, "role": 1}))}
        try:
            migrations.insert_one(migration)
        except DuplicateKeyError:
            migration = migrations.find_one({"_id": MIGRATION_ID})
    if migration.get("completed_at"):
        return {"status": "already_completed", "accounts": len(migration["users"])}
    ids = [row["_id"] for row in migration["users"]]
    if ids:
        database.gp_users.update_many({"_id": {"$in": ids}}, {"$set": {"role": "admin", "updated_at": datetime.now(UTC)}})
    migrations.update_one({"_id": MIGRATION_ID}, {"$set": {"completed_at": datetime.now(UTC)}})
    return {"status": "completed", "accounts": len(ids)}


def main():
    settings = get_settings()
    result = {}
    client = MongoClient(settings.mongodb_url, serverSelectionTimeoutMS=3000)
    try:
        client.admin.command("ping")
        result["mongodb"] = promote_mongo(client[settings.mongodb_database])
    except PyMongoError:
        result["mongodb"] = {"status": "unavailable"}
    finally:
        client.close()
    if settings.environment == "development" and settings.auth_local_db_path.exists():
        result["local"] = promote_local(LocalUserCollection(settings.auth_local_db_path))
    print(json.dumps(result))
    return 0 if any(row["status"] in {"completed", "already_completed"} for row in result.values()) else 1


if __name__ == "__main__":
    raise SystemExit(main())
