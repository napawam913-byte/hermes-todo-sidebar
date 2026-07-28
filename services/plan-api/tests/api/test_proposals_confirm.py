from fastapi.testclient import TestClient

from .proposal_helpers import cycle_create_proposal


def test_same_session_confirms_proposal_and_applies_it_once(
    client: TestClient,
    hermes_headers: dict[str, str],
) -> None:
    created = client.post(
        "/v1/proposals",
        headers=hermes_headers,
        json=cycle_create_proposal(),
    ).json()
    body = {
        "externalSessionId": "hermes-session-1",
        "idempotencyKey": "proposal-confirm-1",
    }

    first = client.post(
        f"/v1/proposals/{created['id']}/confirm",
        headers=hermes_headers,
        json=body,
    )
    repeated = client.post(
        f"/v1/proposals/{created['id']}/confirm",
        headers=hermes_headers,
        json=body,
    )

    assert first.status_code == 200
    assert repeated.status_code == 200
    assert first.json() == repeated.json()
    assert first.json()["proposal"]["status"] == "applied"
    assert first.json()["mutation"]["serverRevision"] == 1

    snapshot = client.get("/v1/snapshot", headers=hermes_headers).json()
    assert snapshot["serverRevision"] == 1
    assert len(snapshot["tasks"]) == 1
    assert snapshot["tasks"][0]["kind"] == "cycle"
    assert snapshot["tasks"][0]["entries"][0]["source"] == "hermes"
