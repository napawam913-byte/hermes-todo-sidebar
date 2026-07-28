from fastapi.testclient import TestClient

from .proposal_helpers import cycle_create_proposal


def _create(
    client: TestClient, headers: dict[str, str]
) -> dict[str, object]:
    response = client.post(
        "/v1/proposals",
        headers=headers,
        json=cycle_create_proposal(),
    )
    assert response.status_code == 201
    return response.json()


def test_same_session_reads_and_cancels_pending_proposal(
    client: TestClient,
    hermes_headers: dict[str, str],
) -> None:
    proposal = _create(client, hermes_headers)
    proposal_id = proposal["id"]

    fetched = client.get(
        f"/v1/proposals/{proposal_id}",
        headers=hermes_headers,
        params={"externalSessionId": "hermes-session-1"},
    )
    body = {
        "externalSessionId": "hermes-session-1",
        "idempotencyKey": "proposal-cancel-1",
    }
    cancelled = client.post(
        f"/v1/proposals/{proposal_id}/cancel",
        headers=hermes_headers,
        json=body,
    )
    repeated = client.post(
        f"/v1/proposals/{proposal_id}/cancel",
        headers=hermes_headers,
        json=body,
    )

    assert fetched.status_code == 200
    assert fetched.json()["status"] == "pending"
    assert cancelled.status_code == 200
    assert repeated.json() == cancelled.json()
    assert cancelled.json()["status"] == "cancelled"
    snapshot = client.get(
        "/v1/snapshot", headers=hermes_headers
    ).json()
    assert snapshot == {"serverRevision": 0, "tasks": []}


def test_other_session_cannot_read_confirm_or_cancel_proposal(
    client: TestClient,
    hermes_headers: dict[str, str],
) -> None:
    proposal_id = _create(client, hermes_headers)["id"]
    body = {
        "externalSessionId": "other-session",
        "idempotencyKey": "other-session-transition",
    }

    responses = [
        client.get(
            f"/v1/proposals/{proposal_id}",
            headers=hermes_headers,
            params={"externalSessionId": "other-session"},
        ),
        client.post(
            f"/v1/proposals/{proposal_id}/confirm",
            headers=hermes_headers,
            json=body,
        ),
        client.post(
            f"/v1/proposals/{proposal_id}/cancel",
            headers=hermes_headers,
            json=body,
        ),
    ]

    assert [response.status_code for response in responses] == [404, 404, 404]
    assert all(
        response.json()["code"] == "target_missing"
        for response in responses
    )
