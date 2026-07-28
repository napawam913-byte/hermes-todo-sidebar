from fastapi import FastAPI
from fastapi.testclient import TestClient

from plan_api.contracts.proposals import ProposalCreateRequest
from .api_helpers import content
from .proposal_helpers import cycle_create_proposal


def _seed_cycle(
    client: TestClient,
    desktop_headers: dict[str, str],
    key: str,
) -> dict[str, object]:
    create = cycle_create_proposal(key=key)
    mutation = {
        "idempotencyKey": f"{key}-mutation",
        "operations": create["operations"],
    }
    response = client.post(
        "/v1/mutations", headers=desktop_headers, json=mutation
    )
    assert response.status_code == 200
    return client.get(
        "/v1/snapshot", headers=desktop_headers
    ).json()["tasks"][-1]


def _adjustment(
    task: dict[str, object],
    *,
    operation_target: str | None = None,
) -> dict[str, object]:
    return {
        "externalSessionId": "adjust-session",
        "idempotencyKey": "adjust-proposal-1",
        "summary": "Rename the selected fitness plan.",
        "targetTaskId": task["id"],
        "targetVersion": task["version"],
        "operations": [
            {
                "type": "task.update",
                "targetId": operation_target or task["id"],
                "expectedVersion": task["version"],
                "patch": {"content": content("Renamed fitness plan")},
            }
        ],
    }


def test_adjustment_is_scoped_and_applied_to_selected_cycle(
    client: TestClient,
    desktop_headers: dict[str, str],
    hermes_headers: dict[str, str],
) -> None:
    task = _seed_cycle(client, desktop_headers, "seed-adjust")
    proposal = client.post(
        "/v1/proposals",
        headers=hermes_headers,
        json=_adjustment(task),
    )
    assert proposal.status_code == 201, proposal.text
    confirmed = client.post(
        f"/v1/proposals/{proposal.json()['id']}/confirm",
        headers=hermes_headers,
        json={
            "externalSessionId": "adjust-session",
            "idempotencyKey": "adjust-confirm-1",
        },
    )

    assert confirmed.status_code == 200
    detail = client.get(
        f"/v1/tasks/{task['id']}", headers=hermes_headers
    ).json()
    assert detail["content"]["title"] == "Renamed fitness plan"


def test_adjustment_contract_is_accepted_by_proposal_service(
    app: FastAPI,
    client: TestClient,
    desktop_headers: dict[str, str],
) -> None:
    task = _seed_cycle(client, desktop_headers, "seed-service-adjust")
    request = ProposalCreateRequest.model_validate(_adjustment(task))

    proposal = app.state.proposal_service.create(request)

    assert proposal.status.value == "pending"


def test_adjustment_rejects_cross_plan_target(
    client: TestClient,
    desktop_headers: dict[str, str],
    hermes_headers: dict[str, str],
) -> None:
    selected = _seed_cycle(client, desktop_headers, "seed-selected")
    other = _seed_cycle(client, desktop_headers, "seed-other")

    response = client.post(
        "/v1/proposals",
        headers=hermes_headers,
        json=_adjustment(selected, operation_target=other["id"]),
    )

    assert response.status_code == 403
    assert response.json()["code"] == "permission_denied"


def test_adjustment_rejects_stale_target_version(
    client: TestClient,
    desktop_headers: dict[str, str],
    hermes_headers: dict[str, str],
) -> None:
    task = _seed_cycle(client, desktop_headers, "seed-stale")
    request = _adjustment(task)
    request["targetVersion"] = 999

    response = client.post(
        "/v1/proposals", headers=hermes_headers, json=request
    )

    assert response.status_code == 409
    assert response.json()["code"] == "version_conflict"
