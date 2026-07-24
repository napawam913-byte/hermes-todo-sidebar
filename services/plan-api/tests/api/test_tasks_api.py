from datetime import date

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient


def test_health_reports_database_and_revision(client: TestClient) -> None:
    response = client.get("/v1/health")
    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "plan-api",
        "apiVersion": 1,
        "database": {"status": "ok"},
        "serverRevision": 0,
    }


def test_empty_snapshot_and_task_list_are_deterministic(
    client: TestClient, desktop_headers: dict[str, str]
) -> None:
    snapshot = client.get("/v1/snapshot", headers=desktop_headers)
    tasks = client.get("/v1/tasks", headers=desktop_headers)
    assert snapshot.json() == {"serverRevision": 0, "tasks": []}
    assert tasks.json() == {"tasks": []}


def test_today_ensures_rolling_window_before_query(
    app: FastAPI,
    client: TestClient,
    desktop_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[date] = []
    original = app.state.rolling_generator.ensure_window

    def record(target_date: date):
        calls.append(target_date)
        return original(target_date)

    monkeypatch.setattr(app.state.rolling_generator, "ensure_window", record)
    response = client.get(
        "/v1/today?date=2026-07-24", headers=desktop_headers
    )
    assert response.status_code == 200
    assert calls == [date(2026, 7, 24)]
    assert response.json() == {"target_date": "2026-07-24", "items": []}


def test_missing_task_is_structured_404(
    client: TestClient, hermes_headers: dict[str, str]
) -> None:
    response = client.get("/v1/tasks/missing", headers=hermes_headers)
    assert response.status_code == 404
    payload = response.json()
    assert payload["code"] == "target_missing"
    assert payload["message"] == "target_missing"
    assert payload["requestId"]
