"""Offline chat security, evidence, storage and API tests."""

from copy import deepcopy
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.api.v1.endpoints import chat
from src.api.v1.endpoints.auth import require_user
from src.services.chat.data import ChatData
from src.services.chat.engine import generate_reply
from src.services.chat.schemas import MessageRequest, Retrieval
from src.services.chat.store import ChatError, ChatStore
from test_mt5_snapshots import SNAPSHOT


CONNECTION_ID = "a" * 24


class Evidence:
    def __init__(self):
        self.sources = []
        self.attachments = {}
        self.calls = []
        self.active = True

    def connection(self, user_id, connection_id):
        self.calls.append((user_id, connection_id))
        if not self.active or user_id != "alice" or connection_id != CONNECTION_ID:
            raise ChatError("CHAT_ACCOUNT_UNAVAILABLE", "حساب در دسترس نیست.", 404)

    def catalog(self):
        return {"indicators": []}

    def retrieve(self, request, user_id, conversation):
        source = {"id": "S1", "title": "دادهٔ آزمون", "href": "/dashboard", "observed_at": "2026-10-01", "status": "available"}
        self.sources.append(source)
        return {"source": source, "data": {"value": 5}}


class Provider:
    def __init__(self, requests=None, refs=None):
        self.inputs = []
        self.requests = requests if requests is not None else [{"kind": "prices"}]
        self.refs = refs if refs is not None else ["S1"]

    def generate_json(self, prompt, evidence):
        self.inputs.append(evidence)
        if len(self.inputs) % 2:
            return {"requests": self.requests}
        return {"answer_fa": "این پاسخ براساس دادهٔ سایت است.", "evidence_refs": self.refs}


@pytest.fixture
def harness(tmp_path, monkeypatch):
    store = ChatStore(tmp_path / "chat.db")
    data = Evidence()
    provider = Provider()
    app = FastAPI()
    app.include_router(chat.router, prefix="/api/v1")
    app.dependency_overrides[require_user] = lambda: {"id": "alice"}
    app.dependency_overrides[chat.chat_store] = lambda: store
    app.dependency_overrides[chat.chat_data] = lambda: data
    monkeypatch.setattr(chat, "chat_provider", lambda: provider)
    return TestClient(app), store, data, provider, app


def test_requires_authentication():
    app = FastAPI()
    app.include_router(chat.router)
    assert TestClient(app).get("/chat/status").status_code == 401


def test_round_trip_idempotency_and_private_history(harness):
    client, store, data, provider, app = harness
    created = client.post("/api/v1/chat/conversations", json={"scope": "site"})
    assert created.status_code == 201
    assert created.headers["cache-control"] == "no-store"
    conversation_id = created.json()["id"]
    payload = {"content": "وضعیت بازار", "request_id": str(uuid4())}
    url = f"/api/v1/chat/conversations/{conversation_id}"
    sent = client.post(url + "/messages", json=payload)
    assert sent.status_code == 200
    assert client.post(url + "/messages", json=payload).json() == sent.json()
    assert len(provider.inputs) == 2
    assert len(client.get(url).json()["messages"]) == 2
    conflicting = {**payload, "content": "پیام دیگر"}
    assert client.post(url + "/messages", json=conflicting).status_code == 409
    app.dependency_overrides[require_user] = lambda: {"id": "bob"}
    assert client.get(url).status_code == 404
    assert client.post(url + "/messages", json=payload).status_code == 404
    assert client.delete(url).status_code == 404
    assert client.get("/api/v1/chat/conversations").json()["conversations"] == []
    assert len(provider.inputs) == 2


def test_consent_scope_and_revoked_account(harness):
    client, store, data, provider, app = harness
    body = {"scope": "account", "connection_id": CONNECTION_ID}
    assert client.post("/api/v1/chat/conversations", json=body).status_code == 422
    assert client.post("/api/v1/chat/conversations", json={"scope": "site", "connection_id": CONNECTION_ID}).status_code == 422
    created = client.post("/api/v1/chat/conversations", json={**body, "account_data_consent": True})
    assert created.status_code == 201
    data.active = False
    result = client.post(f"/api/v1/chat/conversations/{created.json()['id']}/messages", json={"content": "حسابم", "request_id": str(uuid4())})
    assert result.status_code == 404
    assert not provider.inputs


def test_provider_failure_preserves_history_and_releases_lease(harness):
    client, store, data, provider, app = harness
    conversation_id = store.create("alice", "site", None)["id"]
    provider.refs = ["invented-source"]
    payload = {"content": "بازار", "request_id": str(uuid4())}
    url = f"/api/v1/chat/conversations/{conversation_id}"
    assert client.post(url + "/messages", json=payload).status_code == 502
    assert store.get("alice", conversation_id)["messages"] == []
    provider.refs = ["S1"]
    data.sources = []
    assert client.post(url + "/messages", json=payload).status_code == 200
    assert client.delete(url).status_code == 204
    assert client.get(url).status_code == 404


def test_revocation_during_generation_prevents_response_and_persistence(harness, monkeypatch):
    client, store, data, provider, app = harness
    conversation_id = store.create("alice", "account", CONNECTION_ID)["id"]
    original = provider.generate_json
    def revoke_on_answer(prompt, evidence):
        result = original(prompt, evidence)
        if len(provider.inputs) == 2:
            data.active = False
        return result
    monkeypatch.setattr(provider, "generate_json", revoke_on_answer)
    result = client.post(f"/api/v1/chat/conversations/{conversation_id}/messages", json={"content": "حسابم", "request_id": str(uuid4())})
    assert result.status_code == 404
    assert store.get("alice", conversation_id)["messages"] == []


def test_api_backed_offline_features_preserve_treasury_provenance():
    from src.core.config import get_settings

    data = ChatData(get_settings())
    data._online = False
    try:
        dff = data.indicator("federal_funds_rate")
        treasury = data.indicator("us_10y_treasury_yield")
        assert dff["data"]["source"]["series_id"] == "DFF"
        assert treasury["data"]["source"]["provider"] == "U.S. Department of the Treasury daily yield curve"
        assert treasury["data"]["current"]["unit"] == "percent"
        assert dff["data"]["quality"]["freshness_days"] >= 0
        assert treasury["source"]["observed_at"]
    finally:
        data.close()


def test_store_concurrency_rate_limits_and_retention(tmp_path):
    store = ChatStore(tmp_path / "chat.db", daily_limit=1)
    conversation_id = store.create("alice", "site", None)["id"]
    request = MessageRequest(content="سؤال", request_id=uuid4())
    _, lease, _, _ = store.acquire("alice", conversation_id, request)
    with pytest.raises(ChatError, match="پاسخ قبلی"):
        store.acquire("alice", conversation_id, request)
    with pytest.raises(ChatError):
        store.delete("alice", conversation_id)
    store.release("alice", conversation_id, lease)
    with pytest.raises(ChatError) as error:
        store.acquire("alice", conversation_id, request)
    assert error.value.status == 429
    with store.connect() as db:
        db.execute("UPDATE chat_conversations SET updated_epoch=0 WHERE id=?", (conversation_id,))
    assert store.list("alice") == []


def test_planner_cannot_inject_query_or_account_identity():
    provider = Provider(requests=[{"kind": "account", "user_id": "victim"}])
    with pytest.raises(ChatError) as error:
        generate_reply(provider, Evidence(), "alice", {"scope": "site"}, MessageRequest(content="سؤال", request_id=uuid4()), [])
    assert error.value.status == 502
    assert len(provider.inputs) == 1


class Collection:
    def __init__(self, document):
        self.document = document
        self.queries = []

    def find_one(self, query, **kwargs):
        self.queries.append(query)
        return deepcopy(self.document)


def test_account_query_uses_owner_connection_full_identity_and_sanitizes():
    snapshot = deepcopy(SNAPSHOT)
    snapshot["timestamp_utc"] = datetime.now(UTC) - timedelta(hours=1)
    snapshot["account"]["password"] = "secret"
    snapshot["positions"] = [
        {"symbol": "GOLD.raw", "direction": "BUY", "volume": 1, "current_profit_loss": 10, "comment": "private", "position_identifier": "123"},
        {"symbol": "GOLD.raw", "direction": "SELL", "volume": 1, "current_profit_loss": -50},
    ]
    connection = Collection({"account_identity": snapshot["source"]})
    snapshots = Collection(snapshot)
    data = ChatData.__new__(ChatData)
    data.settings = SimpleNamespace(greenpeak_chat_mt5_stale_minutes=5)
    data.db = {"gp_mt5_connections": connection, "gp_mt5_account_snapshots": snapshots}
    data.sources, data.attachments = [], {}
    reply = data.account("alice", CONNECTION_ID, positions=True)
    query = snapshots.queries[0]
    assert query["owner_user_id"] == "alice"
    assert query["connection_id"] == CONNECTION_ID
    assert query["source.account_identifier"] == "123456"
    assert query["source.trade_server"] == "Test-Server"
    assert query["source.broker_company"] == "Test Broker"
    assert connection.queries[0]["revoked_at"] is None
    assert connection.queries[0]["user_id"] == "alice"
    assert reply["source"]["status"] == "stale"
    assert reply["data"]["positions"][0]["current_profit_loss"] == -50
    assert "comment" not in reply["data"]["positions"][1]
    assert "position_identifier" not in reply["data"]["positions"][1]
    assert "123456" not in str(reply)
    data.sources = []
    site = data.retrieve(Retrieval(kind="account"), "alice", {"scope": "site"})
    assert site["status"] == "account_not_selected"
    assert len(snapshots.queries) == 1
    best = data.account("alice", CONNECTION_ID, positions=True, order="best")
    assert best["data"]["positions"][0]["current_profit_loss"] == 10


def test_missing_positions_are_not_an_empty_portfolio():
    snapshot = deepcopy(SNAPSHOT)
    snapshot.pop("positions")
    connection = Collection({"account_identity": snapshot["source"]})
    data = ChatData.__new__(ChatData)
    data.settings = SimpleNamespace(greenpeak_chat_mt5_stale_minutes=5)
    data.db = {"gp_mt5_connections": connection, "gp_mt5_account_snapshots": Collection(snapshot)}
    data.sources, data.attachments = [], {}
    reply = data.account("alice", CONNECTION_ID, positions=True)
    assert reply["data"]["positions_available"] is False
