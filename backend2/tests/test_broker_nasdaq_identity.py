"""Broker-specific Nasdaq-100 symbols share one comparison identity."""

import json
from copy import deepcopy

import pytest
from fastapi.testclient import TestClient

from src.api.v1.endpoints.auth import require_user
from src.api.v1.endpoints.mt5 import broker_comparison_service
from src.main import app
from src.models.mt5_schemas import MT5Snapshot
from src.services.broker_comparison_service import _asset_identity, aggregate_broker_comparison
from test_mt5_snapshots import _comparison_snapshot


@pytest.mark.parametrize("symbol", [
    "NAS100", "nas100.cash", "NAS100m", "US100", "US100.cash", "US100Cash",
    "USTEC", "USTEC.pro", "USTECH", "aUSTECH", "USTECH100", "US_TECH100.m",
    "USATEC100", "NASDAQ", "NASDAQ.cash", "Nasdaq-100", "NDX", "NDX100",
    "NDQ100", "NQ100", "TECH100", "#NAS100", "m.NAS100.raw",
])
def test_supported_aliases_have_one_identity(symbol):
    assert _asset_identity(symbol) == ("nasdaq100", "Nasdaq 100")


@pytest.mark.parametrize("description", [
    "Nasdaq 100 Index", "NASDAQ-100 Cash CFD", "US Tech 100 Index",
    "US Technology 100 Index (NASDAQ 100)", "US100 Index",
])
def test_opaque_broker_names_use_explicit_description(description):
    assert _asset_identity("BROKER_INDEX_A", description) == ("nasdaq100", "Nasdaq 100")


@pytest.mark.parametrize("symbol,description", [
    ("NAS1000", ""), ("NASDAQ1000", ""), ("US1000", ""), ("TECH1000", ""),
    ("USTECH200", ""), ("US30", "Dow Jones 30"), ("BIOTECH100", "Biotechnology index"),
    ("NASDAQCOMP", "Nasdaq Composite Index"), ("NASDAQ", "Nasdaq Composite Index"),
    ("NDAQ", "Nasdaq Inc."), ("AAPL", "Apple Inc. NASDAQ listed"),
    ("QQQ", "Invesco Nasdaq 100 ETF"), ("QQQ", "Nasdaq 100 Exchange Traded Fund"),
    ("NDXEW", "Nasdaq 100 Equal Weight Index"), ("NEXT100", "Nasdaq Next Gen 100"),
    ("opaque", {"name": "Nasdaq 100"}), ("opaque", None),
])
def test_unrelated_indices_stocks_funds_and_malformed_metadata_are_not_merged(symbol, description):
    assert _asset_identity(symbol, description)[0] != "nasdaq100"


def nasdaq_snapshot(broker, account, symbol, description="", spread=2):
    snapshot = _comparison_snapshot("private-owner", account, 1, -3)
    snapshot["source"]["broker_company"] = broker
    snapshot["account"]["trade_mode"] = "real"
    snapshot["broker_symbol_data"] = [{
        "symbol": symbol, "description": description, "bid": 20000, "ask": 20000 + spread,
        "spread_points": spread * 10, "swap_long_raw": -3, "swap_short_raw": 1, "swap_mode": 1,
    }]
    return snapshot


def test_three_brokers_and_duplicate_aliases_produce_one_row_per_account_asset():
    snapshots = [nasdaq_snapshot("Broker A", "private-a", "NAS100.cash"),
                 nasdaq_snapshot("Broker B", "private-b", "USTEC"),
                 nasdaq_snapshot("Broker C", "private-c", "opaque", "Nasdaq 100 Cash Index")]
    snapshots[0]["broker_symbol_data"].append({**snapshots[0]["broker_symbol_data"][0], "symbol": "US100"})
    before = deepcopy(snapshots)
    result = aggregate_broker_comparison(snapshots)
    assert len(result["brokers"]) == 3
    for broker in result["brokers"]:
        assert len(broker["symbols"]) == 1
        row = broker["symbols"][0]
        assert row["asset_key"] == "nasdaq100"
        assert row["asset_label"] == "Nasdaq 100"
        assert row["sample_accounts"] == 1
        assert row["spread_points_median"] == 20
        assert row["swap_long_raw_median"] == -3
    assert snapshots == before
    assert "private-" not in json.dumps(result, default=str)


def test_description_survives_snapshot_contract_and_alternate_metadata_is_supported():
    snapshot = nasdaq_snapshot("Broker", "private-account", "opaque", "Nasdaq 100")
    parsed = MT5Snapshot.model_validate(snapshot).model_dump(mode="python")
    assert parsed["broker_symbol_data"][0]["description"] == "Nasdaq 100"
    parsed["broker_symbol_data"][0]["symbol_description"] = parsed["broker_symbol_data"][0].pop("description")
    assert aggregate_broker_comparison([parsed])["brokers"][0]["symbols"][0]["asset_key"] == "nasdaq100"


@pytest.mark.parametrize("role", ["user", "admin"])
def test_nasdaq_comparison_api_preserves_permissions_redaction_and_health(role):
    result = aggregate_broker_comparison([nasdaq_snapshot("Broker", "private-account", "USTEC")])

    class Comparison:
        def comparison(self):
            return result

    app.dependency_overrides[broker_comparison_service] = Comparison
    app.dependency_overrides[require_user] = lambda: {"id": "viewer", "role": role}
    try:
        client = TestClient(app)
        response = client.get("/api/v1/mt5/broker-comparison")
        assert client.get("/health").status_code == 200
    finally:
        app.dependency_overrides.clear()
    assert response.status_code == 200
    row = response.json()["brokers"][0]["symbols"][0]
    assert row["asset_key"] == "nasdaq100"
    assert ("sample_accounts" in row) == (role == "admin")
    assert "private-account" not in response.text
