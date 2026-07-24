import sqlite3

from fastapi import FastAPI
from fastapi.testclient import TestClient

from .conftest import DESKTOP_TOKEN


class BrokenDatabase:
    def connect(self):
        raise sqlite3.OperationalError("database unavailable")


class BrokenRollingGenerator:
    def ensure_window(self, _target_date) -> None:
        raise sqlite3.OperationalError("query failed")


def test_health_database_failure_is_structured(app: FastAPI) -> None:
    app.state.database = BrokenDatabase()
    with TestClient(app, raise_server_exceptions=False) as client:
        response = client.get("/v1/health")
    assert response.status_code == 503
    payload = response.json()
    assert payload["code"] == "database_unavailable"
    assert payload["message"] == "database_unavailable"
    assert payload["requestId"]
    assert payload["status"] == "degraded"
    assert payload["database"] == {"status": "error"}


def test_unhandled_service_error_is_structured(app: FastAPI) -> None:
    app.state.rolling_generator = BrokenRollingGenerator()
    headers = {"Authorization": f"Bearer {DESKTOP_TOKEN}"}
    with TestClient(app, raise_server_exceptions=False) as client:
        response = client.get("/v1/today?date=2026-07-24", headers=headers)
    assert response.status_code == 500
    payload = response.json()
    assert payload["code"] == "internal_error"
    assert payload["message"] == "internal_error"
    assert payload["requestId"]
