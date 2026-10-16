"""Offline tests for encrypted, owner-only retrieval of original MT5 keys."""

from copy import deepcopy
from types import SimpleNamespace

import pytest
from bson import ObjectId
from fastapi.testclient import TestClient
from pymongo.errors import ServerSelectionTimeoutError

from src.api.v1.endpoints.auth import require_user
from src.api.v1.endpoints.mt5 import connection_service
from src.main import app
from src.services import mt5_connection_service as keys


SOURCE = {"broker_company": "Broker", "trade_server": "Demo", "account_identifier": "123"}


def matches(document, query):
    return all(
        any(matches(document, part) for part in value) if key == "$or"
        else document.get(key) == value
        for key, value in query.items()
    )


class MemoryCollection:
    def __init__(self):
        self.documents = []

    def create_index(self, *args, **kwargs):
        pass

    def insert_one(self, document):
        document["_id"] = ObjectId()
        self.documents.append(deepcopy(document))
        return SimpleNamespace(inserted_id=document["_id"])

    def find(self, query, sort=None):
        return [deepcopy(item) for item in self.documents if matches(item, query)]

    def find_one(self, query):
        return next(iter(self.find(query)), None)

    def update_one(self, query, update):
        for item in self.documents:
            if matches(item, query):
                item.update(deepcopy(update["$set"]))
                return SimpleNamespace(modified_count=1)
        return SimpleNamespace(modified_count=0)

    def find_one_and_update(self, query, update, return_document=None):
        self.update_one(query, update)
        return self.find_one(query)


@pytest.fixture
def service(monkeypatch):
    monkeypatch.setattr(keys, "get_settings", lambda: SimpleNamespace(auth_secret_key="test-only-secret-" * 4))
    collection = MemoryCollection()
    return keys.MT5ConnectionService(SimpleNamespace(get_collection=lambda name: collection))


@pytest.fixture
def client(service):
    app.dependency_overrides[connection_service] = lambda: service
    app.dependency_overrides[require_user] = lambda: {"id": "owner"}
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


def test_created_key_is_encrypted_and_revealed_unchanged(service, client):
    response = client.post("/api/v1/mt5/connections", json={"label": "My broker"})
    assert response.status_code == 201
    data = response.json()
    token = data["pairing_token"]
    connection = data["connection"]
    stored = service.collection.documents[0]
    assert token not in repr(stored)
    assert stored["token_hash"] == keys._token_hash(token)
    assert "encrypted_token" not in connection
    for _ in range(2):
        reveal = client.post(f"/api/v1/mt5/connections/{connection['id']}/reveal-key")
        assert reveal.status_code == 200
        assert reveal.headers["cache-control"] == "no-store"
        assert reveal.json() == {"pairing_token": token}
    listing = client.get("/api/v1/mt5/connections")
    assert token not in listing.text
    assert "encrypted_token" not in listing.text
    assert "token_hash" not in listing.text


def test_reveal_requires_owner_and_active_connection(service, client):
    connection, _ = service.create("owner", "Broker")
    url = f"/api/v1/mt5/connections/{connection['id']}/reveal-key"
    app.dependency_overrides[require_user] = lambda: {"id": "other-user", "role": "admin"}
    assert client.post(url).status_code == 404
    app.dependency_overrides[require_user] = lambda: {"id": "owner"}
    assert client.post("/api/v1/mt5/connections/not-an-id/reveal-key").status_code == 404
    service.revoke("owner", connection["id"])
    assert client.post(url).status_code == 404
    app.dependency_overrides.pop(require_user)
    assert client.post(url).status_code == 401


def test_legacy_key_is_recovered_only_from_valid_upload(service, client):
    connection, token = service.create("owner", "Broker")
    stored = service.collection.documents[0]
    del stored["encrypted_token"]
    url = f"/api/v1/mt5/connections/{connection['id']}/reveal-key"
    response = client.post(url)
    assert response.status_code == 409
    assert response.json()["detail"] == "connection_key_pending_upload"
    assert service.resolve_and_bind("wrong-key", SOURCE) is None
    assert "encrypted_token" not in stored
    assert service.resolve_and_bind(token, SOURCE) is not None
    assert service.reveal_key("owner", connection["id"]) == token
    assert stored["token_hash"] == keys._token_hash(token)
    ciphertext = stored["encrypted_token"]
    assert service.resolve_and_bind(token, SOURCE) is not None
    assert stored["encrypted_token"] == ciphertext
    assert service.resolve_and_bind(token, {**SOURCE, "account_identifier": "999"}) is None
    service.revoke("owner", connection["id"])
    assert service.resolve_and_bind(token, SOURCE) is None


def test_ciphertext_from_another_connection_is_not_revealed(service):
    connection, token = service.create("owner", "First")
    service.create("owner", "Second")
    service.collection.documents[0]["encrypted_token"] = service.collection.documents[1]["encrypted_token"]
    with pytest.raises(keys.ConnectionKeyUnavailableError):
        service.reveal_key("owner", connection["id"])
    service.resolve_and_bind(token, SOURCE)
    assert service.reveal_key("owner", connection["id"]) == token


def test_changed_server_secret_recovers_on_next_upload(service, monkeypatch):
    connection, token = service.create("owner", "Broker")
    monkeypatch.setattr(keys, "get_settings", lambda: SimpleNamespace(auth_secret_key="replacement-secret-" * 4))
    with pytest.raises(keys.ConnectionKeyUnavailableError):
        service.reveal_key("owner", connection["id"])
    assert service.resolve_and_bind(token, SOURCE) is not None
    assert service.reveal_key("owner", connection["id"]) == token


def test_weak_secret_rejects_creation_but_preserves_existing_ingestion(service, client, monkeypatch):
    _, token = service.create("owner", "Broker")
    del service.collection.documents[0]["encrypted_token"]
    monkeypatch.setattr(keys, "get_settings", lambda: SimpleNamespace(auth_secret_key="development-only-change-me"))
    assert client.post("/api/v1/mt5/connections", json={"label": "New"}).status_code == 503
    assert len(service.collection.documents) == 1
    assert service.resolve_and_bind(token, SOURCE) is not None
    assert "encrypted_token" not in service.collection.documents[0]


def test_reveal_storage_failure_is_sanitized(service, client, monkeypatch):
    def unavailable(*args):
        raise ServerSelectionTimeoutError("private database connection details")
    monkeypatch.setattr(service, "reveal_key", unavailable)
    response = client.post(f"/api/v1/mt5/connections/{ObjectId()}/reveal-key")
    assert response.status_code == 503
    assert "private database" not in response.text


def test_health_smoke(client):
    assert client.get("/health").status_code == 200
