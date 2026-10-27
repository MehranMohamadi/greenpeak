"""Broker comparisons must never combine known demo, real or contest costs."""

import json
from copy import deepcopy

import pytest
from fastapi.testclient import TestClient

from src.api.v1.endpoints.auth import require_user
from src.api.v1.endpoints.mt5 import broker_comparison_service
from src.main import app
from src.services.broker_comparison_service import aggregate_broker_comparison
from test_mt5_snapshots import _comparison_snapshot


def account(owner, identifier, mode, spread=1, commission=-3, dividend=1):
    snapshot = _comparison_snapshot(owner, identifier, spread, commission, dividend)
    snapshot["account"]["trade_mode"] = mode
    snapshot["broker_symbol_data"] = snapshot["broker_symbol_data"][:1]
    return snapshot


@pytest.mark.parametrize("mode, expected", [
    (0, "demo"), ("0", "demo"), ("demo", "demo"), ("ACCOUNT_TRADE_MODE_DEMO", "demo"),
    (1, "contest"), ("1", "contest"), ("contest", "contest"), ("ACCOUNT_TRADE_MODE_CONTEST", "contest"),
    (2, "real"), ("2", "real"), (" REAL ", "real"), ("live", "real"), ("ACCOUNT_TRADE_MODE_REAL", "real"),
    (False, "unknown"), (True, "unknown"), (3, "unknown"), (-1, "unknown"),
    (2.0, "unknown"), ("hedging", "unknown"), ({}, "unknown"), ([], "unknown"),
])
def test_explicit_account_type_has_priority_over_server_name(mode, expected):
    snapshot = account("owner", "private-account", mode)
    snapshot["source"]["trade_server"] = "Broker-Demo02"
    assert aggregate_broker_comparison([snapshot])["brokers"][0]["account_type"] == expected


@pytest.mark.parametrize("server, expected", [
    ("Broker-Demo02", "demo"), ("Broker-REAL2", "real"), ("Broker-Live01", "real"),
    ("Broker-Contest", "contest"), ("Broker-Demo-Live", "unknown"),
    ("Broker-ECN", "unknown"), ("Broker-Realtime", "unknown"),
    ("Broker-Demo2x", "unknown"), ("BrokerDemo", "unknown"), ("", "unknown"),
])
def test_legacy_server_classification_requires_an_unambiguous_marker(server, expected):
    snapshot = _comparison_snapshot("owner", "private-account", 1, -3)
    snapshot["source"]["trade_server"] = server
    assert aggregate_broker_comparison([snapshot])["brokers"][0]["account_type"] == expected


def test_real_demo_costs_counts_and_keys_are_independent_for_the_same_broker():
    real_one = account("owner-a", "private-real-1", 2, spread=1, commission=-3, dividend=1)
    real_two = account("owner-b", "private-real-2", "real", spread=3, commission=-5, dividend=3)
    demo = account("owner-a", "private-demo", "demo", spread=40, commission=-20, dividend=10)
    for snapshot, long, short, annual in [(real_one, -2, 1, -1), (real_two, -4, 3, -3), (demo, -100, 40, -1000)]:
        snapshot["broker_symbol_data"][0].update(swap_long_raw=long, swap_short_raw=short,
                                              annualized_long_swap_rate_pct=annual)
    before = deepcopy([real_one, real_two, demo])
    result = aggregate_broker_comparison([real_one, real_two, demo])
    real, practice = result["brokers"]
    assert [item["account_type"] for item in result["brokers"]] == ["real", "demo"]
    assert real["broker_name"] == practice["broker_name"] == "Test Broker"
    assert real["broker_key"] != practice["broker_key"]
    assert (real["sample_accounts"], real["sample_users"]) == (2, 2)
    assert (practice["sample_accounts"], practice["sample_users"]) == (1, 1)
    assert real["commission_per_lot_median"] == 4 and practice["commission_per_lot_median"] == 20
    assert real["dividend_per_lot_median"] == 2 and practice["dividend_per_lot_median"] == 10
    real_symbol, demo_symbol = real["symbols"][0], practice["symbols"][0]
    assert real_symbol["sample_accounts"] == 2 and demo_symbol["sample_accounts"] == 1
    assert real_symbol["spread_points_median"] == 20 and demo_symbol["spread_points_median"] == 400
    assert real_symbol["swap_long_raw_median"] == -3 and demo_symbol["swap_long_raw_median"] == -100
    assert real_symbol["swap_short_raw_median"] == 2 and demo_symbol["swap_short_raw_median"] == 40
    assert real_symbol["swap_long_annualized_pct_median"] == -2 and demo_symbol["swap_long_annualized_pct_median"] == -1000
    assert aggregate_broker_comparison([demo, real_two, real_one])["brokers"] == result["brokers"]
    assert [real_one, real_two, demo] == before  # Raw snapshots remain immutable.
    serialized = json.dumps(result, default=str)
    for secret in ["owner-a", "owner-b", "private-real-1", "private-real-2", "private-demo", "Test-Server"]:
        assert secret not in serialized


def test_unknown_and_contest_accounts_cannot_contribute_to_real_or_demo_costs():
    snapshots = [account("owner", str(i), mode, commission=cost)
                 for i, (mode, cost) in enumerate([(2, -3), (0, -5), (1, -100), ("invalid", -1000)])]
    result = aggregate_broker_comparison(snapshots)
    assert [item["account_type"] for item in result["brokers"]] == ["real", "demo", "contest", "unknown"]
    assert [item["commission_per_lot_median"] for item in result["brokers"]] == [3, 5, 100, 1000]
    assert len({item["broker_key"] for item in result["brokers"]}) == 4


def test_broker_normalization_still_combines_only_accounts_of_the_same_type():
    one, two, demo = [account("owner", str(i), mode) for i, mode in enumerate([2, 2, 0])]
    two["source"]["broker_company"] = "  TEST   BROKER "
    result = aggregate_broker_comparison([one, two, demo])
    assert len(result["brokers"]) == 2
    assert [item["sample_accounts"] for item in result["brokers"]] == [2, 1]


def test_account_type_labels_survive_public_response_without_private_identifiers_or_counts():
    comparison = aggregate_broker_comparison([account("private-owner", "private-account", mode) for mode in [2, 0]])
    class Comparison:
        def comparison(self):
            return comparison
    app.dependency_overrides[broker_comparison_service] = Comparison
    app.dependency_overrides[require_user] = lambda: {"id": "viewer", "username": "member", "role": "user"}
    try:
        response = TestClient(app).get("/api/v1/mt5/broker-comparison")
    finally:
        app.dependency_overrides.clear()
    assert response.status_code == 200
    assert [item["account_type"] for item in response.json()["brokers"]] == ["real", "demo"]
    for field in ["private-owner", "private-account", "trade_server", "sample_accounts", "sample_users", "commission_sample_deals"]:
        assert field not in response.text
