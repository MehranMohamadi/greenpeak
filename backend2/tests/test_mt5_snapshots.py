"""Offline contract and endpoint tests for MT5 snapshots."""

from copy import deepcopy
from datetime import datetime, timezone

from fastapi.testclient import TestClient

from src.api.v1.endpoints.mt5 import snapshot_service
from src.main import app
from src.services.mt5_snapshot_service import MT5SnapshotService


SNAPSHOT = {
    "schema_version": "1.0",
    "snapshot_id": "123456-20260827-1",
    "timestamp_utc": "2026-08-27T10:00:00Z",
    "source": {
        "ea_name": "GreenPeak MT5 Risk Monitor",
        "ea_version": "1.00",
        "terminal_build": 5000,
        "broker_company": "Test Broker",
        "trade_server": "Test-Server",
        "account_identifier": "123456",
        "send_mode": "manual",
    },
    "account": {
        "currency": "USD",
        "balance": 100000,
        "equity": 95000,
        "used_margin": 5000,
        "free_margin": 90000,
        "margin_level_pct": 1900,
        "floating_profit_loss": -5000,
    },
    "portfolio_metrics": {
        "net_portfolio_exposure_usd": 30000,
        "gross_portfolio_exposure_usd": 60000,
        "net_portfolio_leverage": 0.315789,
        "gross_portfolio_leverage": 0.631578,
        "account_current_drawdown_pct": 5,
    },
    "symbol_metrics": [],
    "positions": [],
    "pending_orders": [],
    "broker_symbol_data": [],
    "swap_metrics": {},
    "trade_history_delta": [],
    "calculation_status": {"active_symbol": "OK"},
}


class MemoryService:
    def __init__(self):
        self.document = None

    def store(self, snapshot):
        if self.document is not None:
            return "already_exists"
        self.document = snapshot.model_dump(mode="python")
        return "accepted"

    def latest(self, account_identifier=None):
        if self.document is None:
            return None
        if account_identifier and self.document["source"]["account_identifier"] != account_identifier:
            return None
        return self.document

    def latest_by_account(self):
        return [self.document] if self.document is not None else []


def test_ingestion_requires_token(monkeypatch):
    monkeypatch.setattr("src.api.v1.endpoints.mt5._configured_tokens", lambda: ("secret",))
    response = TestClient(app).post("/api/v1/mt5/snapshots", json=SNAPSHOT)
    assert response.status_code == 401


def test_ingestion_reports_missing_server_token(monkeypatch):
    monkeypatch.setattr("src.api.v1.endpoints.mt5._configured_tokens", lambda: ())
    response = TestClient(app).post("/api/v1/mt5/snapshots", json=SNAPSHOT)
    assert response.status_code == 503
    assert response.json()["detail"] == "MT5 API authentication is not configured"


def test_snapshot_round_trip_and_idempotency(monkeypatch):
    service = MemoryService()
    app.dependency_overrides[snapshot_service] = lambda: service
    monkeypatch.setattr("src.api.v1.endpoints.mt5._configured_tokens", lambda: ("secret",))
    client = TestClient(app)
    headers = {"Authorization": "Bearer secret"}
    try:
        first = client.post("/api/v1/mt5/snapshots", json=deepcopy(SNAPSHOT), headers=headers)
        second = client.post("/api/v1/mt5/snapshots", json=deepcopy(SNAPSHOT), headers=headers)
        latest = client.get("/api/v1/mt5/snapshots/latest?account_identifier=123456", headers=headers)
        accounts = client.get("/api/v1/mt5/snapshots/latest-by-account", headers=headers)
    finally:
        app.dependency_overrides.clear()
    assert first.status_code == 200
    assert first.json()["status"] == "accepted"
    assert second.json()["status"] == "already_exists"
    assert latest.status_code == 200
    assert latest.json()["portfolio_metrics"]["gross_portfolio_exposure_usd"] == 60000
    assert accounts.status_code == 200
    assert [item["source"]["account_identifier"] for item in accounts.json()] == ["123456"]


def test_non_utc_timestamp_is_rejected(monkeypatch):
    monkeypatch.setattr("src.api.v1.endpoints.mt5._configured_tokens", lambda: ("secret",))
    payload = deepcopy(SNAPSHOT)
    payload["timestamp_utc"] = "2026-08-27T13:30:00+03:30"
    response = TestClient(app).post(
        "/api/v1/mt5/snapshots", json=payload, headers={"Authorization": "Bearer secret"}
    )
    assert response.status_code == 422


def test_latest_snapshot_restores_mongodb_utc_timezone():
    document = deepcopy(SNAPSHOT)
    document["timestamp_utc"] = datetime(2026, 8, 27, 10, 0)

    class Collection:
        def find_one(self, query, sort):
            return document

    class MongoDB:
        def get_collection(self, name):
            return Collection()

    result = MT5SnapshotService(MongoDB()).latest("123456")

    assert result is not None
    assert result["timestamp_utc"].tzinfo is timezone.utc


def test_latest_by_account_groups_on_broker_server_and_account():
    document = deepcopy(SNAPSHOT)
    document["timestamp_utc"] = datetime(2026, 8, 27, 10, 0)

    class Collection:
        def __init__(self):
            self.pipeline = None

        def aggregate(self, pipeline):
            self.pipeline = pipeline
            return [document]

    collection = Collection()

    class MongoDB:
        def get_collection(self, name):
            return collection

    result = MT5SnapshotService(MongoDB()).latest_by_account()
    identity = collection.pipeline[1]["$group"]["_id"]

    assert set(identity) == {"broker_company", "trade_server", "account_identifier"}
    assert result[0]["timestamp_utc"].tzinfo is timezone.utc
