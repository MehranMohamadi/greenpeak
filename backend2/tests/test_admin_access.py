"""Role boundaries, sanitized financial responses and one-time migration."""

from datetime import UTC, datetime, timedelta
from copy import deepcopy
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.api.v1.endpoints import analysis, auth, features, mt5
from src.services.auth import AuthService, LocalUserCollection
from src.services.admin_migration import promote_local, promote_mongo
from test_mt5_snapshots import SNAPSHOT, _comparison_snapshot, aggregate_broker_comparison


@pytest.fixture
def harness(tmp_path, monkeypatch):
    service = AuthService(LocalUserCollection(tmp_path / "auth.db"), "test-secret")
    for name, role in (("operator", "admin"), ("member", "user")):
        service.collection.insert_one({"username": name, "username_normalized": name,
                                       "password_hash": "private-hash", "role": role,
                                       "is_active": True, "created_at": datetime.now(UTC)})
    application = FastAPI()
    for router in (auth.router, features.router, analysis.router, mt5.router):
        application.include_router(router, prefix="/api/v1")
    application.dependency_overrides[auth.get_auth_service] = lambda: service
    monkeypatch.setattr(auth, "get_auth_service", lambda: service)
    headers = {role: {"Authorization": "Bearer " + service.create_token({
        "id": str(service.collection.find_one({"username_normalized": name})["_id"]), "username": name,
    })} for name, role in (("operator", "admin"), ("member", "user"))}
    return TestClient(application), service, headers, application


@pytest.mark.parametrize("path,method", [
    ("/auth/admins", "get"), ("/auth/users", "get"), ("/auth/users/2/promote", "post"), ("/admin/analysis/run", "post"),
    ("/admin/analysis/runs/test", "get"), ("/mt5/snapshots", "get"),
    ("/indicators/federal_funds_rate/features/pipeline-debug", "get"),
    ("/indicators/features/pipeline-preview", "post"),
])
def test_admin_routes_reject_anonymous_and_regular_users(harness, path, method):
    client, _, headers, _ = harness
    for authorization, status in (({}, 401), (headers["user"], 403)):
        response = getattr(client, method)("/api/v1" + path, headers=authorization)
        assert response.status_code == status


def test_admin_list_contains_only_safe_admin_fields_and_uses_live_role(harness):
    client, service, headers, _ = harness
    response = client.get("/api/v1/auth/admins", headers=headers["admin"])
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert [row["username"] for row in response.json()["admins"]] == ["operator"]
    assert "private-hash" not in response.text
    assert set(response.json()["admins"][0]) == {"id", "username", "role", "is_active", "created_at"}
    service.collection.update_one({"username_normalized": "operator"}, {"$set": {"role": "user"}})
    assert client.get("/api/v1/auth/admins", headers=headers["admin"]).status_code == 403


def test_user_list_contains_all_accounts_and_only_safe_fields(harness):
    client, service, headers, _ = harness
    response = client.get("/api/v1/auth/users", headers=headers["admin"])
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert [(row["username"], row["role"]) for row in response.json()["users"]] == [("member", "user"), ("operator", "admin")]
    for row in response.json()["users"]:
        assert set(row) == {"id", "username", "role", "is_active", "created_at"}
    assert "private-hash" not in response.text
    service.collection.update_one({"username_normalized": "operator"}, {"$set": {"role": "user"}})
    assert client.get("/api/v1/auth/users", headers=headers["admin"]).status_code == 403


def test_admin_can_promote_user_and_existing_session_gains_admin_role(harness):
    client, service, headers, _ = harness
    before = service.collection.find_one({"username_normalized": "member"})
    response = client.post("/api/v1/auth/users/2/promote", headers=headers["admin"])
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert response.json() == {"id": "2", "username": "member", "role": "admin"}
    after = service.collection.find_one({"_id": 2})
    assert after["password_hash"] == before["password_hash"]
    assert after["is_active"] == before["is_active"]
    assert after["role_promoted_by"] == "1"
    assert after["role_promoted_at"]
    with service.collection._connect() as connection:
        assert connection.execute("SELECT role FROM gp_users WHERE id = 2").fetchone()[0] == "admin"
    assert client.get("/api/v1/auth/admins", headers=headers["user"]).status_code == 200
    assert [row["username"] for row in client.get("/api/v1/auth/admins", headers=headers["admin"]).json()["admins"]] == ["member", "operator"]
    again = client.post("/api/v1/auth/users/2/promote", headers=headers["admin"])
    assert again.json() == response.json()
    assert service.collection.find_one({"_id": 2})["role_promoted_at"] == after["role_promoted_at"]


@pytest.mark.parametrize("user_id", ["999", "invalid", "-1"])
def test_promoting_missing_user_returns_not_found(harness, user_id):
    client, service, headers, _ = harness
    assert client.post(f"/api/v1/auth/users/{user_id}/promote", headers=headers["admin"]).status_code == 404
    assert service.collection.find_one({"_id": 2})["role"] == "user"


def test_promotion_uses_mongo_object_ids():
    from bson import ObjectId
    identifier = ObjectId()
    document = {"_id": identifier, "username": "member", "role": "user"}

    class Collection:
        def find_one(self, query):
            return document.copy() if query["_id"] == identifier else None

        def update_one(self, query, update):
            assert query == {"_id": identifier}
            document.update(update["$set"])

    service = AuthService(Collection(), "test-secret")
    assert service.promote_user_to_admin(str(identifier), "operator")["role"] == "admin"
    assert document["role_promoted_by"] == "operator"
    assert service.promote_user_to_admin("invalid", "operator") is None


def test_public_preview_works_without_revealing_pipeline(harness):
    client, _, headers, _ = harness
    observations = [{"date": (datetime(2024, 1, 1) + timedelta(days=index)).date().isoformat(), "value": 5.25} for index in range(120)]
    payload = {"indicator_id": "federal_funds_rate", "source_series_id": "DFF", "observations": observations}
    response = client.post("/api/v1/indicators/features/preview?as_of=2024-04-29", json=payload)
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["current"]["value_pct"] == 5.25
    assert data["features"]["delta_30d_bp"] == 0
    assert not ({"stages", "pipeline", "provenance", "schema_version", "feature_version"} & data.keys())
    assert set(data["llm_context"]) == {"summary_template_fa"}
    diagnostic = client.post("/api/v1/indicators/features/pipeline-preview?as_of=2024-04-29", json=payload, headers=headers["admin"])
    assert diagnostic.status_code == 200
    assert diagnostic.json()["data"]["stages"]["raw_input"]["total_count"] == 120


def test_analysis_debug_requires_admin_and_public_data_preserves_warnings(harness, monkeypatch):
    client, _, headers, _ = harness
    response = {"ok": True, "data": {"subject_id": "sp500", "narrative_fa": "تحلیل",
        "analysis_version": "1", "revision_id": "revision", "provenance": {"input_hash": "secret-hash"},
        "coverage": {"status": "partial", "ratio": 0.5, "configured_count": 10},
        "warnings": ["Incomplete observations"]}, "metadata": {"storage": "mongodb"}}
    monkeypatch.setattr(analysis, "_latest", lambda *_: deepcopy(response))
    url = "/api/v1/market/analysis/latest"
    public = client.get(url).json()
    assert "provenance" not in public["data"]
    assert public["data"]["coverage"] == {"status": "partial"}
    assert public["data"]["warnings"] == ["Incomplete observations"]
    assert client.get(url + "?mode=debug").status_code == 401
    assert client.get(url + "?mode=debug", headers=headers["user"]).status_code == 403
    assert client.get(url + "?mode=debug", headers=headers["admin"]).json()["data"]["provenance"]["input_hash"] == "secret-hash"


def test_broker_counts_are_never_sent_to_regular_users(harness):
    client, _, headers, app = harness
    comparison = aggregate_broker_comparison([
        _comparison_snapshot("alice", "one", 1, -3), _comparison_snapshot("bob", "two", 2, -4),
    ])
    class Comparison:
        def comparison(self):
            return comparison
    app.dependency_overrides[mt5.broker_comparison_service] = Comparison
    url = "/api/v1/mt5/broker-comparison"
    member = client.get(url, headers=headers["user"])
    assert member.status_code == 200
    for field in ("eligible_broker_count", "excluded_broker_count", "sample_users", "sample_accounts", "commission_sample_deals", "dividend_sample_records"):
        assert field not in member.text
    assert member.json()["brokers"][0]["symbols"][0]["spread_bps_median"] is not None
    from src.models.mt5_schemas import BrokerComparisonResponse
    assert client.get(url, headers=headers["admin"]).json() == BrokerComparisonResponse.model_validate(comparison).model_dump(mode="json")


def test_mt5_financial_reads_remain_owner_scoped_and_hide_raw_metadata(harness):
    client, _, headers, app = harness
    owners = []
    class Snapshots:
        def latest(self, owner, account):
            owners.append(owner)
            return deepcopy(SNAPSHOT)
    app.dependency_overrides[mt5.snapshot_service] = Snapshots
    result = client.get("/api/v1/mt5/snapshots/latest", headers=headers["user"])
    assert result.status_code == 200
    assert owners == ["2"]
    assert result.json()["account"]["equity"] == SNAPSHOT["account"]["equity"]
    assert "schema_version" not in result.json()
    assert "ea_version" not in result.json()["source"]


def test_admin_mt5_reads_preserve_complete_previous_contract(harness):
    from src.models.mt5_schemas import MT5Snapshot
    client, _, headers, app = harness
    owners = []

    class Snapshots:
        def latest(self, owner, account):
            owners.append(owner)
            return deepcopy(SNAPSHOT)

        def latest_by_account(self, owner):
            owners.append(owner)
            return [deepcopy(SNAPSHOT)]

        def all_snapshots(self, owner):
            owners.append(owner)
            return [deepcopy(SNAPSHOT)]

    app.dependency_overrides[mt5.snapshot_service] = Snapshots
    expected = MT5Snapshot.model_validate(SNAPSHOT).model_dump(mode="json")
    for path, payload in (("latest", expected), ("latest-by-account", [expected]), ("", [expected])):
        response = client.get("/api/v1/mt5/snapshots" + ("/" + path if path else ""), headers=headers["admin"])
        assert response.status_code == 200
        assert response.json() == payload
    assert owners == ["1", "1", "1"]


@pytest.mark.parametrize("path", ["market", "domains/monetary_policy", "indicators/federal_funds_rate"])
def test_admin_narratives_preserve_all_fields(harness, monkeypatch, path):
    client, _, headers, _ = harness
    full = {"ok": True, "data": {"analysis_version": "v1", "revision_id": "revision",
        "provenance": {"input_hash": "hash", "run_id": "run"},
        "coverage": {"status": "partial", "ratio": 0.7, "configured_count": 10},
        "narrative_fa": "analysis", "warnings": ["partial"]}, "metadata": {"storage": "mongodb"}}
    monkeypatch.setattr(analysis, "_latest", lambda *_: deepcopy(full))
    monkeypatch.setattr(analysis, "load_registry", lambda: (SimpleNamespace(domains=[SimpleNamespace(id="monetary_policy")]), None, {"federal_funds_rate": {}}))
    response = client.get(f"/api/v1/{path}/analysis/latest?mode=debug", headers=headers["admin"])
    assert response.status_code == 200
    assert response.json()["data"] == full["data"]
    assert response.json()["metadata"]["storage"] == "mongodb"


def test_admin_features_preserve_complete_snapshot_for_stored_and_fallback(harness, monkeypatch):
    client, _, headers, _ = harness
    payload = {"indicator_id": "federal_funds_rate", "source_series_id": "DFF", "observations": [
        {"date": (datetime(2024, 1, 1) + timedelta(days=index)).date().isoformat(), "value": 5.25}
        for index in range(120)
    ]}
    response = client.post("/api/v1/indicators/features/pipeline-preview?as_of=2024-04-29", json=payload, headers=headers["admin"])
    assert response.status_code == 200
    full = response.json()["data"]["stages"]["validated_snapshot"]["snapshot"]
    assert {"feature_version", "schema_version", "provenance", "run_id"} <= full.keys()
    monkeypatch.setattr(features, "MongoClient", lambda *_args, **_kwargs: SimpleNamespace(close=lambda: None))
    monkeypatch.setattr(features, "MongoFeatureRepository", lambda *_: SimpleNamespace(latest_snapshot=lambda _: deepcopy(full)))
    url = "/api/v1/indicators/federal_funds_rate/features/latest"
    admin = client.get(url + "?mode=debug", headers=headers["admin"])
    assert admin.status_code == 200
    assert admin.json()["data"] == full
    user = client.get(url, headers=headers["user"])
    assert user.status_code == 200
    assert user.json()["data"]["features"] == full["features"]
    assert "provenance" not in user.json()["data"]


def test_admin_can_queue_and_inspect_manual_analysis(harness, monkeypatch):
    client, _, headers, _ = harness
    runs = {}
    executed = []

    class Runs:
        def insert_one(self, document):
            runs[document["run_id"]] = document

        def find_one(self, query, projection):
            return runs.get(query["run_id"])

    class Mongo:
        def __getitem__(self, name):
            return SimpleNamespace(gp_manual_analysis_runs=Runs())

        def close(self):
            pass

    monkeypatch.setattr(analysis, "MongoClient", lambda *_args, **_kwargs: Mongo())
    monkeypatch.setattr(analysis, "llm_is_configured", lambda _: True)
    monkeypatch.setattr(analysis, "_execute_manual_analysis", lambda run_id, force: executed.append((run_id, force)))
    response = client.post("/api/v1/admin/analysis/run?force_llm=false", headers=headers["admin"])
    assert response.status_code == 202
    run_id = response.json()["data"]["run_id"]
    assert executed == [(run_id, False)]
    status = client.get(f"/api/v1/admin/analysis/runs/{run_id}", headers=headers["admin"])
    assert status.status_code == 200
    assert status.json()["data"]["force_llm"] is False


def test_local_migration_is_atomic_and_does_not_promote_new_accounts(tmp_path):
    collection = LocalUserCollection(tmp_path / "auth.db")
    service = AuthService(collection, "test-secret")
    existing, token = service.signup("existing", "password123")
    assert promote_local(collection) == {"status": "completed", "accounts": 1}
    assert service.user_from_token(token)["role"] == "admin"
    new, _ = service.signup("new.member", "password123")
    assert new["role"] == "user"
    assert promote_local(collection) == {"status": "already_completed", "accounts": 1}
    assert collection.find_one({"username_normalized": "new.member"})["role"] == "user"
    assert [admin["id"] for admin in service.list_admins()] == [existing["id"]]


def test_mongo_migration_freezes_existing_ids_and_is_resumable():
    class Migrations:
        document = None
        def find_one(self, query): return self.document
        def insert_one(self, document): self.document = deepcopy(document)
        def update_one(self, query, update): self.document.update(update["$set"])
    class Users:
        rows = [{"_id": "old", "role": "user"}]
        fail = True
        def find(self, query, projection): return deepcopy(self.rows)
        def update_many(self, query, update):
            if self.fail: raise RuntimeError("interrupted")
            for row in self.rows:
                if row["_id"] in query["_id"]["$in"]: row.update(update["$set"])
    class Database:
        gp_auth_migrations = Migrations()
        gp_users = Users()
    database = Database()
    with pytest.raises(RuntimeError): promote_mongo(database)
    database.gp_users.rows.append({"_id": "new", "role": "user"})
    database.gp_users.fail = False
    assert promote_mongo(database)["status"] == "completed"
    assert database.gp_users.rows[0]["role"] == "admin"
    assert database.gp_users.rows[1]["role"] == "user"
    assert promote_mongo(database)["status"] == "already_completed"
