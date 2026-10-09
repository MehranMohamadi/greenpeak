"""Offline ownership, deletion and concurrent-ingestion checks for broker removal."""

from copy import deepcopy
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
from bson import ObjectId
from fastapi.testclient import TestClient
from pymongo.errors import DuplicateKeyError, ServerSelectionTimeoutError

from src.api.v1.endpoints.auth import require_user
from src.api.v1.endpoints.mt5 import connection_service, snapshot_service
from src.main import app
from src.models.mt5_schemas import MT5Snapshot
from src.services.mt5_connection_service import COLLECTION as CONNECTION_COLLECTION
from src.services.mt5_snapshot_service import COLLECTION, MT5ConnectionUnavailableError, MT5SnapshotService
from test_mt5_snapshots import SNAPSHOT


def matches(item, query):
    for key, expected in query.items():
        value = item
        for part in key.split("."):
            value = value.get(part) if isinstance(value, dict) else None
        if value != expected:
            return False
    return True


class Collection:
    def __init__(self, name, documents, operations):
        self.name = name
        self.documents = documents
        self.operations = operations
        self.after_insert = None

    def find(self, query, projection=None, sort=None):
        values = [deepcopy(item) for item in self.documents if matches(item, query)]
        if sort:
            values.sort(key=lambda item: item["timestamp_utc"], reverse=True)
        return values

    def find_one(self, query, sort=None):
        return next(iter(self.find(query, sort=sort)), None)

    def aggregate(self, pipeline):
        values = self.find(pipeline[0]["$match"], sort=[("timestamp_utc", -1)])
        newest = {}
        for item in values:
            source = item["source"]
            key = (source["broker_company"], source["trade_server"], source["account_identifier"])
            newest.setdefault(key, item)
        return list(newest.values())

    def delete_many(self, query):
        self.operations.append((self.name, deepcopy(query)))
        original = len(self.documents)
        self.documents[:] = [item for item in self.documents if not matches(item, query)]
        return SimpleNamespace(deleted_count=original - len(self.documents))

    def create_index(self, *args, **kwargs):
        pass

    def insert_one(self, item):
        if any(row["snapshot_id"] == item["snapshot_id"] for row in self.documents):
            raise DuplicateKeyError("Duplicate snapshot")
        self.documents.append(deepcopy(item))
        if self.after_insert:
            self.after_insert()


class Database:
    def __init__(self):
        self.operations = []
        self.collections = {
            COLLECTION: Collection(COLLECTION, [], self.operations),
            CONNECTION_COLLECTION: Collection(CONNECTION_COLLECTION, [], self.operations),
        }

    def get_collection(self, name):
        return self.collections[name]


def snapshot(owner, broker, account, suffix, server="Test-Server"):
    item = deepcopy(SNAPSHOT)
    item.update(owner_user_id=owner, snapshot_id=f"snapshot-{suffix}", connection_id="old-connection")
    item["timestamp_utc"] = datetime(2026, 8, 27, 10, int(suffix), tzinfo=timezone.utc)
    item["source"].update(broker_company=broker, account_identifier=account, trade_server=server)
    item["positions"] = [{"symbol": "XAUUSD", "ticket": suffix}]
    item["pending_orders"] = [{"symbol": "EURUSD", "ticket": suffix}]
    item["trade_history_delta"] = [{"symbol": "US500", "ticket": suffix}]
    return item


def connection(owner, broker, account, server="Test-Server"):
    return {
        "_id": ObjectId(), "user_id": owner, "revoked_at": None,
        "account_identity": None if broker is None else {
            "broker_company": broker, "trade_server": server, "account_identifier": account,
        },
    }


@pytest.fixture
def database():
    db = Database()
    db.collections[COLLECTION].documents = [
        snapshot("user-1", "Test Broker", "123", "1"),
        snapshot("user-1", "Test Broker", "123", "2"),
        snapshot("user-1", "Test Broker", "456", "3", "Other-Server"),
        snapshot("user-1", "Other Broker", "123", "4"),
        snapshot("user-2", "Test Broker", "123", "5"),
    ]
    db.collections[CONNECTION_COLLECTION].documents = [
        connection("user-1", "Test Broker", "123"),
        connection("user-1", "Test Broker", "456", "Other-Server"),
        connection("user-1", "Test Broker", "historical-only"),
        connection("user-1", "Other Broker", "123"),
        connection("user-2", "Test Broker", "123"),
        connection("user-1", None, ""),
    ]
    return db


@pytest.fixture
def client(database):
    app.dependency_overrides[snapshot_service] = lambda: MT5SnapshotService(database)
    app.dependency_overrides[require_user] = lambda: {"id": "user-1"}
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


def test_deletion_requires_user_session():
    assert TestClient(app).request("DELETE", "/api/v1/mt5/brokers", json={"broker_company": "Test Broker"}).status_code == 401


@pytest.mark.parametrize("body", [
    {}, {"broker_company": ""}, {"broker_company": "   "},
    {"broker_company": {"$ne": None}}, {"broker_company": "Test Broker", "owner_user_id": "user-2"},
])
def test_invalid_delete_requests_do_not_touch_storage(client, database, body):
    response = client.request("DELETE", "/api/v1/mt5/brokers", json=body)
    assert response.status_code == 422
    assert database.operations == []


def test_delete_removes_every_owned_account_and_history_but_preserves_others(client, database):
    response = client.request("DELETE", "/api/v1/mt5/brokers", json={"broker_company": "Test Broker"})
    assert response.status_code == 200
    body = response.json()
    assert body["deleted_snapshots"] == 3
    assert body["deleted_connections"] == 3
    assert {item["account_identifier"] for item in body["deleted_accounts"]} == {"123", "456", "historical-only"}
    assert database.operations == [
        (CONNECTION_COLLECTION, {"user_id": "user-1", "account_identity.broker_company": "Test Broker"}),
        (COLLECTION, {"owner_user_id": "user-1", "source.broker_company": "Test Broker"}),
    ]
    remaining = database.collections[COLLECTION].documents
    assert {(item["owner_user_id"], item["source"]["broker_company"]) for item in remaining} == {
        ("user-1", "Other Broker"), ("user-2", "Test Broker"),
    }
    assert len(database.collections[CONNECTION_COLLECTION].documents) == 3
    # All dashboard consumers and the complete JSON history lose the deleted data.
    for path in ("/snapshots", "/snapshots/latest-by-account"):
        result = client.get("/api/v1/mt5" + path)
        assert result.status_code == 200
        assert [item["source"]["broker_company"] for item in result.json()] == ["Other Broker"]
    latest = client.get("/api/v1/mt5/snapshots/latest")
    assert latest.status_code == 200
    assert latest.json()["source"]["broker_company"] == "Other Broker"


def test_deletion_is_idempotent_and_unknown_broker_is_safe(client, database):
    first = client.request("DELETE", "/api/v1/mt5/brokers", json={"broker_company": "Test Broker"})
    second = client.request("DELETE", "/api/v1/mt5/brokers", json={"broker_company": "Test Broker"})
    unknown = client.request("DELETE", "/api/v1/mt5/brokers", json={"broker_company": "Test"})
    assert first.status_code == second.status_code == unknown.status_code == 200
    assert second.json()["deleted_snapshots"] == second.json()["deleted_connections"] == 0
    assert unknown.json()["deleted_accounts"] == []
    assert len(database.collections[COLLECTION].documents) == 2


def test_broker_deletion_leaves_no_dashboard_data_when_it_was_last_account(client, database):
    client.request("DELETE", "/api/v1/mt5/brokers", json={"broker_company": "Test Broker"})
    client.request("DELETE", "/api/v1/mt5/brokers", json={"broker_company": "Other Broker"})
    assert client.get("/api/v1/mt5/snapshots").json() == []
    assert client.get("/api/v1/mt5/snapshots/latest-by-account").json() == []
    assert client.get("/api/v1/mt5/snapshots/latest").status_code == 404
    assert len(database.collections[COLLECTION].documents) == 1  # Another user's data.


def test_storage_failure_is_retryable_and_does_not_expose_database_details(client):
    class Unavailable:
        def delete_broker(self, *args):
            raise ServerSelectionTimeoutError("private-db-connection-secret")
    app.dependency_overrides[snapshot_service] = lambda: Unavailable()
    response = client.request("DELETE", "/api/v1/mt5/brokers", json={"broker_company": "Test Broker"})
    assert response.status_code == 503
    assert "private-db-connection-secret" not in response.text


def test_retry_finishes_cleanup_after_connection_deletion_succeeded(database):
    service = MT5SnapshotService(database)
    collection = database.collections[COLLECTION]
    delete_many = collection.delete_many
    def fail_once(query):
        raise ServerSelectionTimeoutError("unavailable")
    collection.delete_many = fail_once
    with pytest.raises(ServerSelectionTimeoutError):
        service.delete_broker("user-1", "Test Broker")
    assert len(database.collections[CONNECTION_COLLECTION].documents) == 3
    collection.delete_many = delete_many
    result = service.delete_broker("user-1", "Test Broker")
    assert result["deleted_snapshots"] == 3
    assert result["deleted_connections"] == 0


def test_upload_that_races_with_deletion_cannot_restore_broker_data(database):
    service = MT5SnapshotService(database)
    paired = database.collections[CONNECTION_COLLECTION].documents[0]
    collection = database.collections[COLLECTION]
    collection.after_insert = lambda: service.delete_broker("user-1", "Test Broker")
    with pytest.raises(MT5ConnectionUnavailableError):
        service.store(MT5Snapshot.model_validate(SNAPSHOT), "user-1", str(paired["_id"]))
    assert not any(
        row["owner_user_id"] == "user-1" and row["source"]["broker_company"] == "Test Broker"
        for row in collection.documents
    )
    # Also covers the upload arriving after the delete finished.
    collection.after_insert = None
    with pytest.raises(MT5ConnectionUnavailableError):
        service.store(MT5Snapshot.model_validate(SNAPSHOT), "user-1", str(paired["_id"]))
    assert len(collection.documents) == 2


def test_active_connection_can_still_upload_idempotently(database):
    service = MT5SnapshotService(database)
    paired = database.collections[CONNECTION_COLLECTION].documents[0]
    payload = MT5Snapshot.model_validate(SNAPSHOT)
    assert service.store(payload, "user-1", str(paired["_id"])) == "accepted"
    assert service.store(payload, "user-1", str(paired["_id"])) == "already_exists"


def test_ingestion_returns_401_if_connection_disappears_during_upload(client):
    class StaleConnection:
        def resolve_and_bind(self, token, source):
            return {"_id": ObjectId(), "user_id": "user-1"}
    class RejectedUpload:
        def store(self, *args):
            raise MT5ConnectionUnavailableError()
    app.dependency_overrides[connection_service] = lambda: StaleConnection()
    app.dependency_overrides[snapshot_service] = lambda: RejectedUpload()
    response = client.post("/api/v1/mt5/snapshots", json=SNAPSHOT, headers={"Authorization": "Bearer old-token"})
    assert response.status_code == 401
