import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from plan_api.contracts.mutations import MutationError

from .api_helpers import content, daily_create, delete_batch


def assert_error(response, status: int, code: str) -> None:
    assert response.status_code == status
    payload = response.json()
    assert payload["code"] == code
    assert payload["message"] == code
    assert payload["requestId"]


def test_hermes_cannot_execute_mutations(
    client: TestClient, hermes_headers: dict[str, str]
) -> None:
    response = client.post(
        "/v1/mutations", headers=hermes_headers, json=daily_create()
    )
    assert_error(response, 403, "permission_denied")


def test_desktop_creates_daily_task_then_reads_detail_and_today(
    client: TestClient,
    desktop_headers: dict[str, str],
    hermes_headers: dict[str, str],
) -> None:
    created = client.post(
        "/v1/mutations", headers=desktop_headers, json=daily_create()
    )
    assert created.status_code == 200
    task_id = created.json()["changedTaskIds"][0]

    for headers in (desktop_headers, hermes_headers):
        detail = client.get(f"/v1/tasks/{task_id}", headers=headers)
        assert detail.status_code == 200
        assert detail.json()["id"] == task_id

    today = client.get(
        "/v1/today?date=2026-07-24", headers=hermes_headers
    )
    assert today.status_code == 200
    assert today.json()["items"][0]["entry"]["task_id"] == task_id


def test_missing_mutation_target_maps_to_404(
    client: TestClient, desktop_headers: dict[str, str]
) -> None:
    response = client.post(
        "/v1/mutations",
        headers=desktop_headers,
        json=delete_batch("missing", "not-found"),
    )
    assert_error(response, 404, "target_missing")


def test_stale_mutation_version_maps_to_409(
    client: TestClient, desktop_headers: dict[str, str]
) -> None:
    created = client.post(
        "/v1/mutations",
        headers=desktop_headers,
        json=daily_create("for-stale-version"),
    )
    task_id = created.json()["changedTaskIds"][0]
    response = client.post(
        "/v1/mutations",
        headers=desktop_headers,
        json=delete_batch("stale", task_id, version=2),
    )
    assert_error(response, 409, "version_conflict")


def test_executor_validation_failure_maps_to_422(
    client: TestClient, desktop_headers: dict[str, str]
) -> None:
    created = client.post(
        "/v1/mutations",
        headers=desktop_headers,
        json={
            "idempotencyKey": "create-cycle",
            "operations": [{
                "type": "task.create",
                "draft": {
                    "kind": "cycle",
                    "generation_mode": "fixed",
                    "content": content("Cycle"),
                    "entries": [],
                },
            }],
        },
    )
    task_id = created.json()["changedTaskIds"][0]
    response = client.post(
        "/v1/mutations",
        headers=desktop_headers,
        json={
            "idempotencyKey": "invalid-rule-change",
            "operations": [{
                "type": "task.update",
                "targetId": task_id,
                "expectedVersion": 1,
                "patch": {
                    "scheduleRule": {
                        "schemaVersion": 1,
                        "timezone": "Asia/Shanghai",
                        "horizonDays": 7,
                        "slots": [{
                            "slotKey": "daily",
                            "cadence": {"type": "daily"},
                            "content": content("Generated"),
                        }],
                    }
                },
            }],
        },
    )
    assert_error(response, 422, "validation_failed")


def test_request_validation_is_structured(
    client: TestClient, desktop_headers: dict[str, str]
) -> None:
    response = client.post(
        "/v1/mutations",
        headers=desktop_headers,
        json={"idempotencyKey": "empty", "operations": []},
    )
    assert_error(response, 422, "validation_failed")


def test_persistence_failure_maps_to_500(
    app: FastAPI,
    client: TestClient,
    desktop_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fail(*_args, **_kwargs):
        raise MutationError("persistence_failed")

    monkeypatch.setattr(app.state.mutation_executor, "execute", fail)
    response = client.post(
        "/v1/mutations", headers=desktop_headers, json=daily_create()
    )
    assert_error(response, 500, "persistence_failed")
