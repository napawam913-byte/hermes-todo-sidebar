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


def test_today_does_not_mutate_rolling_window_for_read_role(
    app: FastAPI,
    client: TestClient,
    hermes_headers: dict[str, str],
) -> None:
    class FailingGenerator:
        def ensure_window(self, _target_date) -> None:
            raise AssertionError("read route must not generate rows")

    app.state.rolling_generator = FailingGenerator()
    response = client.get(
        "/v1/today?date=2026-07-24", headers=hermes_headers
    )
    assert response.status_code == 200
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
