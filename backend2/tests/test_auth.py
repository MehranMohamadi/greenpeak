import os
from types import SimpleNamespace
import pytest

from fastapi import FastAPI
from fastapi.testclient import TestClient
from pymongo.errors import DuplicateKeyError, ServerSelectionTimeoutError

os.environ["DEBUG"] = "false"

from src.api.v1.endpoints.auth import get_auth_service, get_identity_service, router, _attempts
from src.services.auth import AuthService, LocalUserCollection, verify_password
from src.services.auth_identity import IdentityService


@pytest.fixture(autouse=True)
def clear_rate_limit():
    _attempts.clear()


class MemoryEmail:
    def __init__(self):
        self.messages = []

    def check(self):
        pass

    def send(self, email, purpose, token):
        self.messages.append((email, purpose, token))


class InsertResult:
    def __init__(self, inserted_id):
        self.inserted_id = inserted_id


class MemoryUsers:
    def __init__(self):
        self.documents = []

    def create_index(self, *_args, **_kwargs):
        return "username_normalized_1"

    def insert_one(self, document):
        if self.find_one({"username_normalized": document["username_normalized"]}):
            raise DuplicateKeyError("duplicate username")
        stored = {**document, "_id": str(len(self.documents) + 1)}
        self.documents.append(stored)
        return InsertResult(stored["_id"])

    def find_one(self, query):
        return next((item for item in self.documents if all(item.get(key) == value for key, value in query.items())), None)

    def update_one(self, query, update):
        document = self.find_one(query)
        if document is None:
            return SimpleNamespace(modified_count=0)
        document.update(update.get("$set", {}))
        for key in update.get("$unset", {}):
            document.pop(key, None)
        for key, amount in update.get("$inc", {}).items():
            document[key] = document.get(key, 0) + amount
        return SimpleNamespace(modified_count=1)


def make_client():
    collection = MemoryUsers()
    service = AuthService(collection, "test-secret", token_ttl_seconds=60)
    app = FastAPI()
    app.include_router(router, prefix="/api/v1")
    app.dependency_overrides[get_auth_service] = lambda: service
    collection.sender = MemoryEmail()
    settings = SimpleNamespace(auth_email_token_ttl_seconds=3600, google_client_id="test-client")
    identity = IdentityService(service, settings, sender=collection.sender)
    app.dependency_overrides[get_identity_service] = lambda: identity
    return TestClient(app), collection


def test_signup_login_and_me_round_trip():
    client, collection = make_client()

    signup = client.post("/api/v1/auth/signup", json={"username": "New.User", "email": "new@example.com", "password": "secret12"})
    assert signup.status_code == 201
    assert signup.json()["verification_required"] is True
    assert "access_token" not in signup.json()
    assert collection.documents[0]["password_hash"] != "secret12"
    assert verify_password("secret12", collection.documents[0]["password_hash"])
    assert client.post("/api/v1/auth/login", json={"username": "New.User", "password": "secret12"}).status_code == 401
    token = collection.sender.messages[-1][2]
    assert client.post("/api/v1/auth/verify-email", json={"token": token}).status_code == 200
    assert client.post("/api/v1/auth/verify-email", json={"token": token}).status_code == 401

    login = client.post("/api/v1/auth/login", json={"username": "new.user", "password": "secret12"})
    assert login.status_code == 200
    token = login.json()["access_token"]

    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json() == {"id": "1", "username": "New.User", "role": "user"}
    assert client.get("/api/v1/auth/session").status_code == 200
    assert "HttpOnly" in login.headers["set-cookie"]
    assert client.post("/api/v1/auth/logout").status_code == 200
    assert client.get("/api/v1/auth/session").status_code == 401


def test_duplicate_username_and_wrong_password_are_rejected():
    client, _ = make_client()
    payload = {"username": "member", "email": "member@example.com", "password": "secret12"}
    assert client.post("/api/v1/auth/signup", json=payload).status_code == 201
    assert client.post("/api/v1/auth/signup", json={**payload, "email": "another@example.com"}).status_code == 409
    assert client.post("/api/v1/auth/login", json={**payload, "password": "wrong12"}).status_code == 401


def test_test_user_is_created_once_without_replacing_an_existing_user():
    _client, collection = make_client()
    service = AuthService(collection, "test-secret")
    service.ensure_test_user("greenpeak", "greenpeak")
    first_hash = collection.documents[0]["password_hash"]
    service.ensure_test_user("greenpeak", "another-password")

    assert len(collection.documents) == 1
    assert verify_password("greenpeak", first_hash)


def test_local_sqlite_fallback_persists_signup_login_and_session(tmp_path):
    database_path = tmp_path / "auth.db"
    service = AuthService(LocalUserCollection(database_path), "test-secret", token_ttl_seconds=60)
    user, _ = service.signup("local.user", "secret12")

    restarted_service = AuthService(LocalUserCollection(database_path), "test-secret", token_ttl_seconds=60)
    logged_in_user, token = restarted_service.login("LOCAL.USER", "secret12")

    assert logged_in_user == user
    assert restarted_service.user_from_token(token) == user


def test_development_uses_local_store_when_mongodb_is_unavailable(tmp_path, monkeypatch):
    class UnavailableMongoClient:
        admin = None

        def __init__(self, *_args, **_kwargs):
            self.admin = self

        def command(self, _command):
            raise ServerSelectionTimeoutError("MongoDB unavailable")

        def close(self):
            return None

    class LocalSettings:
        environment = "development"
        auth_local_fallback_enabled = True
        auth_local_db_path = tmp_path / "auth.db"
        auth_secret_key = "test-secret"
        auth_token_ttl_seconds = 60
        mongodb_url = "mongodb://127.0.0.1:27017"
        mongodb_database = "test"

    monkeypatch.setattr("src.services.auth.MongoClient", UnavailableMongoClient)
    service = AuthService.from_settings(LocalSettings())

    user, token = service.signup("fallback.user", "secret12")
    assert service.user_from_token(token) == user
