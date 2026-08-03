import os

from fastapi.testclient import TestClient

os.environ["DEBUG"] = "false"
os.environ["ENVIRONMENT"] = "development"

from src.main import app


client = TestClient(app)


def test_root_health_endpoint():
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "healthy",
        "service": "sp500-dashboard-api",
    }


def test_versioned_system_health_endpoint():
    response = client.get("/api/v1/system/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["message"] == "SP500 Dashboard API is running"
    assert payload["version"] == "2.0.0"
    assert payload["timestamp"]
