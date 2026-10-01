"""Offline contract and endpoint tests for MT5 snapshots."""

import json
from copy import deepcopy
from datetime import datetime, timezone

from fastapi.testclient import TestClient

from src.api.v1.endpoints.auth import require_user
from src.api.v1.endpoints.mt5 import (
    broker_comparison_service,
    connection_service,
    snapshot_service,
)
from src.main import app
from src.services.broker_comparison_service import aggregate_broker_comparison
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

    def store(self, snapshot, owner_user_id, connection_id):
        if self.document is not None:
            return "already_exists"
        self.document = snapshot.model_dump(mode="python")
        return "accepted"

    def latest(self, owner_user_id, account_identifier=None):
        if self.document is None:
            return None
        if account_identifier and self.document["source"]["account_identifier"] != account_identifier:
            return None
        return self.document

    def latest_by_account(self, owner_user_id):
        return [self.document] if self.document is not None else []

    def all_snapshots(self, owner_user_id):
        return [self.document] if self.document is not None else []


class MemoryConnections:
    def resolve_and_bind(self, token, source):
        if token != "pairing-secret":
            return None
        return {"_id": "connection-1", "user_id": "user-1"}


def test_ingestion_requires_token():
    response = TestClient(app).post("/api/v1/mt5/snapshots", json=SNAPSHOT)
    assert response.status_code == 401


def test_ingestion_rejects_invalid_pairing_token():
    app.dependency_overrides[connection_service] = lambda: MemoryConnections()
    try:
        response = TestClient(app).post(
            "/api/v1/mt5/snapshots", json=SNAPSHOT, headers={"Authorization": "Bearer invalid"}
        )
    finally:
        app.dependency_overrides.clear()
    assert response.status_code == 401


def test_snapshot_round_trip_and_idempotency():
    service = MemoryService()
    app.dependency_overrides[snapshot_service] = lambda: service
    app.dependency_overrides[connection_service] = lambda: MemoryConnections()
    app.dependency_overrides[require_user] = lambda: {"id": "user-1", "username": "member", "role": "user"}
    client = TestClient(app)
    pairing_headers = {"Authorization": "Bearer pairing-secret"}
    user_headers = {"Authorization": "Bearer user-session"}
    payload = deepcopy(SNAPSHOT)
    payload["additional_snapshot_data"] = {"nested_value": "preserved"}
    try:
        first = client.post("/api/v1/mt5/snapshots", json=payload, headers=pairing_headers)
        second = client.post("/api/v1/mt5/snapshots", json=payload, headers=pairing_headers)
        latest = client.get("/api/v1/mt5/snapshots/latest?account_identifier=123456", headers=user_headers)
        accounts = client.get("/api/v1/mt5/snapshots/latest-by-account", headers=user_headers)
        all_snapshots = client.get("/api/v1/mt5/snapshots", headers=user_headers)
    finally:
        app.dependency_overrides.clear()
    assert first.status_code == 200
    assert first.json()["status"] == "accepted"
    assert second.json()["status"] == "already_exists"
    assert latest.status_code == 200
    assert latest.json()["portfolio_metrics"]["gross_portfolio_exposure_usd"] == 60000
    assert accounts.status_code == 200
    assert [item["source"]["account_identifier"] for item in accounts.json()] == ["123456"]
    assert all_snapshots.status_code == 200
    assert all_snapshots.json()[0]["snapshot_id"] == SNAPSHOT["snapshot_id"]
    assert all_snapshots.json()[0]["additional_snapshot_data"] == {"nested_value": "preserved"}


def test_non_utc_timestamp_is_rejected():
    payload = deepcopy(SNAPSHOT)
    payload["timestamp_utc"] = "2026-08-27T13:30:00+03:30"
    response = TestClient(app).post(
        "/api/v1/mt5/snapshots", json=payload, headers={"Authorization": "Bearer pairing-secret"}
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

    result = MT5SnapshotService(MongoDB()).latest("user-1", "123456")

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

    result = MT5SnapshotService(MongoDB()).latest_by_account("user-1")
    identity = collection.pipeline[2]["$group"]["_id"]

    assert collection.pipeline[0] == {"$match": {"owner_user_id": "user-1"}}
    assert set(identity) == {"broker_company", "trade_server", "account_identifier"}
    assert result[0]["timestamp_utc"].tzinfo is timezone.utc


def test_all_snapshots_are_sorted_newest_first():
    document = deepcopy(SNAPSHOT)
    document["timestamp_utc"] = datetime(2026, 8, 27, 10, 0)

    class Collection:
        def __init__(self):
            self.query = None
            self.sort = None

        def find(self, query, sort):
            self.query = query
            self.sort = sort
            return [document]

    collection = Collection()

    class MongoDB:
        def get_collection(self, name):
            return collection

    result = MT5SnapshotService(MongoDB()).all_snapshots("user-1")

    assert collection.query == {"owner_user_id": "user-1"}
    assert collection.sort == [("timestamp_utc", -1)]
    assert result[0]["timestamp_utc"].tzinfo is timezone.utc


def _comparison_snapshot(owner, account, spread, commission, dividend=None):
    item = deepcopy(SNAPSHOT)
    item["owner_user_id"] = owner
    item["source"]["account_identifier"] = account
    item["timestamp_utc"] = datetime(2026, 8, 27, 10, 0, tzinfo=timezone.utc)
    item["broker_symbol_data"] = [
        {
            "symbol": "US500.cash",
            "bid": 5000,
            "ask": 5000 + spread,
            "spread_points": spread * 10,
            "swap_long_raw": -4,
            "swap_short_raw": 1,
            "swap_mode": 1,
            "annualized_long_swap_rate_pct": -3.2,
            "annualized_short_swap_rate_pct": 0.8,
        },
        {
            "symbol": "XAUUSD",
            "bid": 2500,
            "ask": 2500.5,
            "spread_points": 50,
            "swap_long_raw": -20,
            "swap_short_raw": 8,
            "swap_mode": 1,
        },
        {
            "symbol": "EURUSD.m",
            "bid": 1.1,
            "ask": 1.1001,
            "spread_points": 10,
            "swap_long_raw": -5,
            "swap_short_raw": 2,
            "swap_mode": 1,
        },
        {
            "symbol": "BTCUSD.pro",
            "bid": 65000,
            "ask": 65020,
            "spread_points": 20,
            "swap_long_raw": -1.2,
            "swap_short_raw": -1.2,
            "swap_mode": 5,
        },
    ]
    deal = {"volume": 1, "commission": commission}
    if dividend is not None:
        deal["dividend_adjustment"] = dividend
    item["trade_history_delta"] = [deal]
    return item


def test_broker_comparison_is_aggregated_anonymous_and_column_ready():
    second = _comparison_snapshot("owner-beta", "account-two", 2, -5.0, 1.5)
    second["broker_symbol_data"][3]["swap_mode"] = 6
    snapshots = [
        _comparison_snapshot("owner-alpha", "account-one", 1, -3.5, 0.5),
        second,
    ]

    result = aggregate_broker_comparison(snapshots)

    assert result["eligible_broker_count"] == 1
    assert result["privacy"] == {"identifiers_included": False}
    broker = result["brokers"][0]
    assert broker["sample_users"] == 2
    assert broker["sample_accounts"] == 2
    assert broker["commission_per_lot_median"] == 4.25
    assert broker["dividend_per_lot_median"] == 1.0
    assert [symbol["asset_key"] for symbol in broker["symbols"]][:4] == [
        "sp500",
        "gold",
        "eurusd",
        "bitcoin",
    ]
    sp500 = broker["symbols"][0]
    assert sp500["spread_points_median"] == 15
    assert sp500["swap_long_annualized_pct_median"] == -3.2
    bitcoin = broker["symbols"][3]
    assert bitcoin["swap_mode_mixed"] is True
    assert bitcoin["swap_long_raw_median"] is None
    serialized = json.dumps(result, default=str)
    assert "owner-alpha" not in serialized
    assert "account-one" not in serialized
    assert "trade_server" not in serialized


def test_broker_comparison_includes_accounts_from_one_user():
    snapshots = [
        _comparison_snapshot("owner-alpha", "account-one", 1, -3.5),
        _comparison_snapshot("owner-alpha", "account-two", 2, -5.0),
    ]

    result = aggregate_broker_comparison(snapshots)

    assert result["eligible_broker_count"] == 1
    assert result["excluded_broker_count"] == 0
    assert result["brokers"][0]["sample_accounts"] == 2
    assert result["brokers"][0]["sample_users"] == 1


def test_latest_accounts_for_aggregation_groups_by_owner_and_account():
    document = _comparison_snapshot("owner-alpha", "account-one", 1, -3.5)
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

    result = MT5SnapshotService(MongoDB()).latest_accounts_for_aggregation()
    identity = collection.pipeline[1]["$group"]["_id"]

    assert set(identity) == {"owner_user_id", "broker_company", "trade_server", "account_identifier"}
    assert result[0]["owner_user_id"] == "owner-alpha"
    assert result[0]["timestamp_utc"].tzinfo is timezone.utc


def test_broker_comparison_endpoint_uses_aggregate_contract():
    result = aggregate_broker_comparison([
        _comparison_snapshot("owner-alpha", "account-one", 1, -3.5),
        _comparison_snapshot("owner-beta", "account-two", 2, -5.0),
    ])

    class MemoryComparison:
        def comparison(self):
            return result

    app.dependency_overrides[broker_comparison_service] = lambda: MemoryComparison()
    app.dependency_overrides[require_user] = lambda: {"id": "viewer", "username": "member", "role": "user"}
    try:
        response = TestClient(app).get(
            "/api/v1/mt5/broker-comparison",
            headers={"Authorization": "Bearer user-session"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["brokers"][0]["broker_name"] == "Test Broker"
    assert response.json()["privacy"]["identifiers_included"] is False
