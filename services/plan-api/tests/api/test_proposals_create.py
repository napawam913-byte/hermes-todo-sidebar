from fastapi.testclient import TestClient

from .proposal_helpers import cycle_create_proposal


def test_hermes_creates_pending_proposal_without_writing_tasks(
    client: TestClient,
    hermes_headers: dict[str, str],
) -> None:
    response = client.post(
        "/v1/proposals",
        headers=hermes_headers,
        json=cycle_create_proposal(),
    )

    assert response.status_code == 201
    proposal = response.json()
    assert proposal["externalSessionId"] == "hermes-session-1"
    assert proposal["summary"] == "Create a four week fitness plan."
    assert proposal["status"] == "pending"
    assert proposal["targetTaskId"] is None
    assert proposal["targetVersion"] is None
    assert proposal["operations"][0]["type"] == "task.create"

    snapshot = client.get("/v1/snapshot", headers=hermes_headers)
    assert snapshot.json() == {"serverRevision": 0, "tasks": []}


def test_proposal_creation_is_idempotent_but_rejects_key_reuse(
    client: TestClient,
    hermes_headers: dict[str, str],
) -> None:
    request = cycle_create_proposal()
    first = client.post(
        "/v1/proposals", headers=hermes_headers, json=request
    )
    repeated = client.post(
        "/v1/proposals", headers=hermes_headers, json=request
    )
    changed = cycle_create_proposal(title="Different plan")
    conflict = client.post(
        "/v1/proposals", headers=hermes_headers, json=changed
    )

    assert first.status_code == 201
    assert repeated.status_code == 201
    assert first.json() == repeated.json()
    assert conflict.status_code == 422
    assert conflict.json()["code"] == "validation_failed"


def test_desktop_token_cannot_create_hermes_proposal(
    client: TestClient,
    desktop_headers: dict[str, str],
) -> None:
    response = client.post(
        "/v1/proposals",
        headers=desktop_headers,
        json=cycle_create_proposal(),
    )

    assert response.status_code == 403
    assert response.json()["code"] == "permission_denied"
