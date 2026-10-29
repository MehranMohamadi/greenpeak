"""Session checks record activity only when the page explicitly reports visibility."""

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from src.api.v1.endpoints import auth as auth_api
from src.api.v1.endpoints.auth import get_auth_service
from src.main import create_app
from src.services import auth
from test_auth import MemoryUsers


class MemoryMongoUsers(MemoryUsers):
    def find(self, query, projection):
        return [{key: row[key] for key in projection if key in row}
                for row in self.documents if all(row.get(key) == value for key, value in query.items())]


@pytest.fixture(params=["sqlite", "mongo"])
def harness(request, tmp_path, monkeypatch):
    clock = [datetime(2026, 10, 29, 12, tzinfo=timezone.utc)]

    class Clock(datetime):
        @classmethod
        def now(cls, tz=None):
            return clock[0] if tz else clock[0].replace(tzinfo=None)

    monkeypatch.setattr(auth, "datetime", Clock)
    collection = auth.LocalUserCollection(tmp_path / "activity.db") if request.param == "sqlite" else MemoryMongoUsers()
    service = auth.AuthService(collection, "test-secret")
    collection.insert_one({"username": "member", "username_normalized": "member", "role": "user",
                           "is_active": True, "password_hash": auth.hash_password("password12")})
    document = collection.find_one({"username_normalized": "member"})
    token = service.create_token({"id": str(document["_id"]), "username": "member"})
    application = create_app()
    application.dependency_overrides[get_auth_service] = lambda: service
    settings = auth_api.get_settings().model_copy(update={"auth_local_test_user_enabled": False})
    monkeypatch.setattr(auth_api, "get_settings", lambda: settings)
    return TestClient(application), service, {"Authorization": f"Bearer {token}"}, clock


def test_existing_session_presence_uses_server_time_and_admin_list_exposes_utc(harness):
    client, service, headers, clock = harness
    assert client.get("/health").status_code == 200
    assert service.list_users()[0]["last_active_at"] is None
    # Background session/role polling must not claim visible activity.
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 200
    assert service.list_users()[0]["last_active_at"] is None
    response = client.get("/api/v1/auth/me?record_activity=true&last_active_at=2099-01-01", headers=headers)
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert service.list_users()[0]["last_active_at"] == clock[0]
    assert response.json() == {"id": service.list_users()[0]["id"], "username": "member", "role": "user", "can_view_premium_analysis": False}
    initial = clock[0]
    clock[0] += timedelta(minutes=2)
    # A hidden tab still receives live access changes without claiming activity.
    service.collection.update_one({"username_normalized": "member"}, {"$set": {"role": "staff"}})
    background = client.get("/api/v1/auth/me?record_activity=false", headers=headers)
    assert background.status_code == 200
    assert background.json()["role"] == "staff"
    assert background.headers["cache-control"] == "no-store"
    assert service.list_users()[0]["last_active_at"] == initial
    assert client.get("/api/v1/auth/users", headers=headers).status_code == 403
    service.collection.update_one({"username_normalized": "member"}, {"$set": {"role": "admin"}})
    row = client.get("/api/v1/auth/users", headers=headers).json()["users"][0]
    assert datetime.fromisoformat(row["last_active_at"].replace("Z", "+00:00")) == initial
    assert "password_hash" not in row


def test_heartbeat_throttles_writes_and_handles_naive_mongo_dates(harness):
    client, service, headers, clock = harness
    initial = clock[0]
    service.collection.update_one({"username_normalized": "member"}, {"$set": {"last_active_at": initial.replace(tzinfo=None)}})
    clock[0] = initial + timedelta(seconds=59)
    assert client.get("/api/v1/auth/me?record_activity=true", headers=headers).status_code == 200
    assert service.list_users()[0]["last_active_at"] == initial
    clock[0] = initial + timedelta(seconds=60)
    assert client.get("/api/v1/auth/me?record_activity=true", headers=headers).status_code == 200
    assert service.list_users()[0]["last_active_at"] == clock[0]


def test_login_records_activity_but_invalid_and_revoked_sessions_do_not(harness):
    client, service, headers, clock = harness
    assert client.get("/api/v1/auth/me?record_activity=true").status_code == 401
    assert client.get("/api/v1/auth/me?record_activity=true", headers={"Authorization": "Bearer invalid"}).status_code == 401
    assert client.post("/api/v1/auth/login", json={"username": "member", "password": "wrong"}).status_code == 401
    assert service.list_users()[0]["last_active_at"] is None
    assert client.post("/api/v1/auth/login", json={"username": "member", "password": "password12"}).status_code == 200
    initial = clock[0]
    assert service.list_users()[0]["last_active_at"] == initial
    clock[0] += timedelta(minutes=2)
    service.collection.update_one({"username_normalized": "member"}, {"$set": {"session_version": 1}})
    assert client.get("/api/v1/auth/me?record_activity=true", headers=headers).status_code == 401
    assert service.list_users()[0]["last_active_at"] == initial


def test_concurrent_old_presence_cannot_overwrite_newer_activity(harness):
    _, service, _, clock = harness
    old_document = dict(service.collection.find_one({"username_normalized": "member"}))
    service._record_activity(old_document)
    initial = clock[0]
    clock[0] += timedelta(minutes=2)
    service._record_activity(old_document)
    assert service.list_users()[0]["last_active_at"] == initial
