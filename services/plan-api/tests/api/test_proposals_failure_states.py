from datetime import datetime, timedelta, timezone

from fastapi import FastAPI
from fastapi.testclient import TestClient

from plan_api.services.proposal_service import ProposalService

from .api_helpers import content
from .proposal_helpers import cycle_create_proposal
from .test_proposals_adjust import _adjustment, _seed_cycle


def test_expired_proposal_is_recorded_and_cannot_be_confirmed(
    app: FastAPI,
    client: TestClient,
    hermes_headers: dict[str, str],
) -> None:
    current = [datetime(2026, 7, 28, tzinfo=timezone.utc)]
    app.state.proposal_service = ProposalService(
        app.state.database,
        mutation_executor=app.state.mutation_executor,
        clock=lambda: current[0],
    )
    proposal = client.post(
        "/v1/proposals",
        headers=hermes_headers,
        json=cycle_create_proposal(),
    ).json()
    current[0] += timedelta(minutes=31)

    response = client.post(
        f"/v1/proposals/{proposal['id']}/confirm",
        headers=hermes_headers,
        json={
            "externalSessionId": "hermes-session-1",
            "idempotencyKey": "expired-confirm",
        },
    )
    fetched = client.get(
        f"/v1/proposals/{proposal['id']}",
        headers=hermes_headers,
        params={"externalSessionId": "hermes-session-1"},
    )

    assert response.status_code == 409
    assert response.json()["code"] == "proposal_expired"
    assert fetched.json()["status"] == "expired"


def test_version_conflict_marks_proposal_failed_without_partial_write(
    client: TestClient,
    desktop_headers: dict[str, str],
    hermes_headers: dict[str, str],
) -> None:
    task = _seed_cycle(client, desktop_headers, "seed-conflict")
    proposal = client.post(
        "/v1/proposals",
        headers=hermes_headers,
        json=_adjustment(task),
    ).json()
    desktop_update = {
        "idempotencyKey": "desktop-intervening-update",
        "operations": [
            {
                "type": "task.update",
                "targetId": task["id"],
                "expectedVersion": task["version"],
                "patch": {"content": content("Desktop newer title")},
            }
        ],
    }
    assert client.post(
        "/v1/mutations",
        headers=desktop_headers,
        json=desktop_update,
    ).status_code == 200

    response = client.post(
        f"/v1/proposals/{proposal['id']}/confirm",
        headers=hermes_headers,
        json={
            "externalSessionId": "adjust-session",
            "idempotencyKey": "conflicting-confirm",
        },
    )
    fetched = client.get(
        f"/v1/proposals/{proposal['id']}",
        headers=hermes_headers,
        params={"externalSessionId": "adjust-session"},
    )
    detail = client.get(
        f"/v1/tasks/{task['id']}", headers=hermes_headers
    ).json()

    assert response.status_code == 409
    assert response.json()["code"] == "version_conflict"
    assert fetched.json()["status"] == "failed"
    assert detail["content"]["title"] == "Desktop newer title"
