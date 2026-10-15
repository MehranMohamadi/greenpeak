"""One-time production rename, invoked by the release deployment script."""

from datetime import UTC, datetime

from pymongo import ASCENDING, MongoClient
from pymongo.errors import DuplicateKeyError, PyMongoError


MIGRATION_ID = "rename-mreal-to-test-v1"
SOURCE = "mreal"
TARGET = "test"


class MigrationError(Exception):
    """Safe deployment error without database connection details."""


def rename_mongo(database):
    users = database.gp_users
    migrations = database.gp_auth_migrations
    migration = migrations.find_one({"_id": MIGRATION_ID})
    if migration and migration.get("completed_at"):
        return "already_completed"

    # The index also prevents a concurrent signup from claiming the target.
    users.create_index([("username_normalized", ASCENDING)], unique=True)
    if migration is None:
        source = users.find_one({"username_normalized": SOURCE})
        if source is None:
            raise MigrationError("Account mreal was not found; rename was not applied.")
        migration = {"_id": MIGRATION_ID, "user_id": source["_id"],
                     "created_at": datetime.now(UTC)}
        try:
            migrations.insert_one(migration)
        except DuplicateKeyError:
            migration = migrations.find_one({"_id": MIGRATION_ID})

    # Always resume against the captured ID, never a newly registered mreal.
    identity = {"_id": migration["user_id"]}
    source = users.find_one(identity)
    if source is None:
        raise MigrationError("The captured account no longer exists; rename stopped.")
    if source.get("username_normalized") == SOURCE:
        if users.find_one({"username_normalized": TARGET}) is not None:
            raise MigrationError("Username test is already registered; rename stopped.")
        try:
            users.update_one({**identity, "username_normalized": SOURCE}, {"$set": {
                "username": TARGET, "username_normalized": TARGET,
                "updated_at": datetime.now(UTC),
            }})
        except DuplicateKeyError:
            raise MigrationError("Username test is already registered; rename stopped.") from None

    renamed = users.find_one(identity)
    if not renamed or renamed.get("username") != TARGET or renamed.get("username_normalized") != TARGET:
        raise MigrationError("The captured account changed unexpectedly; rename stopped.")
    migrations.update_one({"_id": MIGRATION_ID}, {"$set": {"completed_at": datetime.now(UTC)}})
    return "completed"


def main():
    client = None
    try:
        from ..core.config import get_settings

        settings = get_settings()
        client = MongoClient(settings.mongodb_url, serverSelectionTimeoutMS=5000)
        result = rename_mongo(client[settings.mongodb_database])
        print(f"{MIGRATION_ID}: {result}")
        return 0
    except MigrationError as exc:
        print(f"{MIGRATION_ID}: {exc}")
    except PyMongoError:
        print(f"{MIGRATION_ID}: database operation failed; deployment stopped.")
    except Exception:
        # Settings errors may embed secret values; never print their details.
        print(f"{MIGRATION_ID}: migration failed; deployment stopped.")
    finally:
        if client is not None:
            client.close()
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
