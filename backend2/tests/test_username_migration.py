from copy import deepcopy
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from pymongo.errors import DuplicateKeyError, ServerSelectionTimeoutError

from src.services import username_migration as migration
from src.services.auth import AuthError, AuthService, hash_password


class Collection:
    def __init__(self, documents=()):
        self.documents = {row["_id"]: deepcopy(row) for row in documents}

    def find_one(self, query):
        return next((deepcopy(row) for row in self.documents.values()
                     if all(row.get(key) == value for key, value in query.items())), None)

    def create_index(self, *args, **kwargs):
        pass

    def insert_one(self, document):
        if document["_id"] in self.documents:
            raise DuplicateKeyError("duplicate")
        self.documents[document["_id"]] = deepcopy(document)

    def update_one(self, query, update):
        row = self.find_one(query)
        if row:
            self.documents[row["_id"]].update(update["$set"])


@pytest.fixture
def database():
    return SimpleNamespace(
        gp_users=Collection([{"_id": "original-id", "username": "mreal",
                             "username_normalized": "mreal", "role": "admin",
                             "password_hash": hash_password("existing-password"),
                             "email": "member@example.com", "email_verified": True}]),
        gp_auth_migrations=Collection(),
    )


def test_rename_preserves_account_and_allows_existing_password(database):
    auth = AuthService(database.gp_users, "test-secret")
    before = database.gp_users.find_one({"_id": "original-id"})
    _, old_token = auth.login("mreal", "existing-password")
    assert migration.rename_mongo(database) == "completed"
    after = database.gp_users.find_one({"_id": "original-id"})
    for key in before.keys() - {"username", "username_normalized"}:
        assert after[key] == before[key]
    user, token = auth.login("test", "existing-password")
    assert user == {"id": "original-id", "username": "test", "role": "admin", "can_view_premium_analysis": False}
    assert auth.user_from_token(token) == user
    with pytest.raises(AuthError):
        auth.login("mreal", "existing-password")
    with pytest.raises(AuthError):
        auth.user_from_token(old_token)


def test_completed_migration_never_renames_a_new_mreal(database):
    migration.rename_mongo(database)
    database.gp_users.insert_one({"_id": "new-id", "username": "mreal", "username_normalized": "mreal"})
    before = deepcopy(database.gp_users.documents)
    assert migration.rename_mongo(database) == "already_completed"
    assert database.gp_users.documents == before


def test_existing_target_is_not_overwritten(database):
    database.gp_users.insert_one({"_id": "other-id", "username": "Test", "username_normalized": "test"})
    before = deepcopy(database.gp_users.documents)
    with pytest.raises(migration.MigrationError, match="already registered"):
        migration.rename_mongo(database)
    assert database.gp_users.documents == before
    assert not database.gp_auth_migrations.find_one({"_id": migration.MIGRATION_ID}).get("completed_at")


def test_missing_source_does_not_guess_target_identity(database):
    database.gp_users.documents.clear()
    database.gp_users.insert_one({"_id": "other-id", "username": "test", "username_normalized": "test"})
    with pytest.raises(migration.MigrationError, match="not found"):
        migration.rename_mongo(database)
    assert not database.gp_auth_migrations.documents


@pytest.mark.parametrize("renamed", [False, True])
def test_interrupted_migration_resumes_same_id(database, renamed):
    database.gp_auth_migrations.insert_one({"_id": migration.MIGRATION_ID, "user_id": "original-id"})
    if renamed:
        database.gp_users.update_one({"_id": "original-id"}, {"$set": {"username": "test", "username_normalized": "test"}})
        database.gp_users.insert_one({"_id": "new-id", "username": "mreal", "username_normalized": "mreal"})
    assert migration.rename_mongo(database) == "completed"
    assert database.gp_users.find_one({"_id": "original-id"})["username"] == "test"
    if renamed:
        assert database.gp_users.find_one({"_id": "new-id"})["username"] == "mreal"


@pytest.mark.parametrize("deleted", [False, True])
def test_changed_captured_account_is_not_replaced(database, deleted):
    database.gp_auth_migrations.insert_one({"_id": migration.MIGRATION_ID, "user_id": "original-id"})
    if deleted:
        database.gp_users.documents.clear()
    else:
        database.gp_users.update_one({"_id": "original-id"}, {"$set": {"username_normalized": "different"}})
    database.gp_users.insert_one({"_id": "new-id", "username": "mreal", "username_normalized": "mreal"})
    before = deepcopy(database.gp_users.documents)
    with pytest.raises(migration.MigrationError):
        migration.rename_mongo(database)
    assert database.gp_users.documents == before


def test_concurrent_signup_collision_is_safe(database):
    before = deepcopy(database.gp_users.documents)
    database.gp_users.update_one = Mock(side_effect=DuplicateKeyError("private details"))
    with pytest.raises(migration.MigrationError, match="already registered"):
        migration.rename_mongo(database)
    assert database.gp_users.documents == before


def test_concurrent_migration_uses_winning_captured_id(database):
    insert = database.gp_auth_migrations.insert_one

    def competing_insert(document):
        insert(document)
        raise DuplicateKeyError("another worker captured the same account")

    database.gp_auth_migrations.insert_one = competing_insert
    assert migration.rename_mongo(database) == "completed"


def test_cli_failure_is_sanitized(monkeypatch, capsys):
    monkeypatch.setenv("DEBUG", "false")
    client = Mock()
    client.__getitem__ = Mock(side_effect=ServerSelectionTimeoutError("secret connection string"))
    monkeypatch.setattr(migration, "MongoClient", Mock(return_value=client))
    assert migration.main() == 1
    output = capsys.readouterr().out
    assert "secret" not in output
    assert "deployment stopped" in output
    client.close.assert_called_once()
