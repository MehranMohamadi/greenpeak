"""Per-user entitlement enforcement using persisted local auth, no live services."""

from copy import deepcopy
from types import SimpleNamespace

import pytest

from src.api.v1.endpoints import analysis
from src.services.auth import AuthService, LocalUserCollection
from src.services.analysis_access import can_view_premium_analysis
from src.services.chat.data import ChatData
from test_admin_access import harness


def test_admin_toggle_persists_without_changing_role_password_or_session(harness):
    client, service, headers, _ = harness
    path = "/api/v1/auth/users/2/analysis-access"
    before = deepcopy(service.collection.find_one({"_id": 2}))
    assert client.put(path, json={"enabled": True}).status_code == 401
    assert client.put(path, headers=headers["user"], json={"enabled": True}).status_code == 403
    for enabled in (True, False):
        response = client.put(path, headers=headers["admin"], json={"enabled": enabled})
        assert response.status_code == 200
        assert response.headers["cache-control"] == "no-store"
        assert response.json()["can_view_premium_analysis"] is enabled
        current = client.get("/api/v1/auth/me", headers=headers["user"]).json()
        assert current["can_view_premium_analysis"] is enabled
        assert current["role"] == "user"
        restarted = AuthService(LocalUserCollection(service.collection.database_path), "test-secret")
        assert restarted.collection.find_one({"_id": 2})["can_view_premium_analysis"] is enabled
    after = service.collection.find_one({"_id": 2})
    for key in ("username", "password_hash", "role", "is_active", "created_at"):
        assert before[key] == after[key]


def test_toggle_rejects_non_boolean_and_missing_target(harness):
    client, _, headers, _ = harness
    path = "/api/v1/auth/users/2/analysis-access"
    for value in ("true", 1, None):
        assert client.put(path, headers=headers["admin"], json={"enabled": value}).status_code == 422
    assert client.put("/api/v1/auth/users/nope/analysis-access", headers=headers["admin"], json={"enabled": True}).status_code == 404


@pytest.mark.parametrize("path", ["indicators/federal_funds_rate", "domains/monetary_policy"])
def test_restricted_endpoints_use_current_db_permission(harness, monkeypatch, path):
    client, _, headers, _ = harness
    monkeypatch.setattr(analysis, "load_registry", lambda: (SimpleNamespace(domains=[SimpleNamespace(id="monetary_policy")]), None, {"federal_funds_rate": {}}))
    monkeypatch.setattr(analysis, "_latest", lambda *_: {"data": {"narrative_fa": "protected"}})
    url = f"/api/v1/{path}/analysis/latest"
    assert client.get(url).status_code == 403
    assert client.get(url, headers=headers["user"]).status_code == 403
    assert client.get(url, headers=headers["admin"]).status_code == 200
    for enabled, expected in ((True, 200), (False, 403)):
        client.put("/api/v1/auth/users/2/analysis-access", headers=headers["admin"], json={"enabled": enabled})
        assert client.get(url, headers=headers["user"]).status_code == expected


def test_market_retains_flow_factors_and_status_but_redacts_outlooks(harness, monkeypatch):
    client, _, headers, _ = harness
    data = {"current_analysis_fa": "public flow", "current_market_move_fa": "current move",
            "market_drivers": [{"title_fa": "public factor"}], "status_summary": {"sentiment": "neutral"},
            "short_term_outlook_fa": "private short", "medium_term_outlook_fa": "private medium",
            "summary_points_fa": ["private conclusion"], "systemic_synthesis_fa": "private legacy",
            "narrative_fa": "private legacy"}
    monkeypatch.setattr(analysis, "_latest", lambda *_: {"ok": True, "data": deepcopy(data)})
    monkeypatch.setattr(analysis, "next_scheduled_analysis_at", lambda: None)
    url = "/api/v1/market/analysis/latest"
    for auth_headers in ({}, headers["user"]):
        response = client.get(url, headers=auth_headers)
        assert response.status_code == 200
        assert "private" not in response.text
        assert response.json()["data"]["current_analysis_fa"] == "public flow"
        assert response.json()["data"]["market_drivers"] == data["market_drivers"]
    assert client.get(url, headers=headers["admin"]).json()["data"] == data
    client.put("/api/v1/auth/users/2/analysis-access", headers=headers["admin"], json={"enabled": True})
    assert client.get(url, headers=headers["user"]).json()["data"] == data


def test_chat_retrieval_cannot_load_premium_analysis_for_locked_user():
    data = ChatData.__new__(ChatData)
    data.online = lambda: pytest.fail("Must reject before reading premium analysis")
    assert data.analysis("federal_funds_rate")["status"] == "premium_required"
    assert data.analysis("monetary_liquidity")["status"] == "premium_required"


def test_capability_is_strict_and_admin_is_independent_of_toggle():
    assert not can_view_premium_analysis({"role": "user", "can_view_premium_analysis": "true"})
    assert not can_view_premium_analysis(None)
    assert can_view_premium_analysis({"role": "admin", "can_view_premium_analysis": False})
    assert can_view_premium_analysis({"role": "user", "can_view_premium_analysis": True})
