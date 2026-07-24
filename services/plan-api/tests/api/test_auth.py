import pytest
from fastapi.security import HTTPAuthorizationCredentials
from fastapi.testclient import TestClient

from plan_api.api import auth
from plan_api.api.auth import TokenRole
from plan_api.settings import Settings


def assert_error(response, status: int, code: str) -> None:
    assert response.status_code == status
    payload = response.json()
    assert payload["code"] == code
    assert payload["message"] == code
    assert isinstance(payload["requestId"], str)
    assert payload["requestId"]


def test_missing_token_is_structured_401(client: TestClient) -> None:
    assert_error(client.get("/v1/tasks"), 401, "missing_token")


def test_invalid_token_is_structured_401(client: TestClient) -> None:
    response = client.get(
        "/v1/tasks",
        headers={"Authorization": "Bearer not-a-valid-token"},
    )
    assert_error(response, 401, "invalid_token")


def test_role_resolution_compares_both_tokens(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    comparisons: list[tuple[bytes, bytes]] = []

    def compare(candidate: bytes, configured: bytes) -> bool:
        comparisons.append((candidate, configured))
        return candidate == configured

    monkeypatch.setattr(auth.secrets, "compare_digest", compare)
    settings = Settings(tmp_path / "plan.db", "desktop", "hermes")
    credentials = HTTPAuthorizationCredentials(
        scheme="Bearer", credentials="desktop"
    )
    assert auth.resolve_role(credentials, settings) is TokenRole.DESKTOP
    assert comparisons == [
        (b"desktop", b"desktop"),
        (b"desktop", b"hermes"),
    ]


@pytest.mark.parametrize("fixture_name", ["desktop_headers", "hermes_headers"])
@pytest.mark.parametrize(
    "path",
    ["/v1/snapshot", "/v1/today?date=2026-07-24", "/v1/tasks"],
)
def test_both_roles_can_read(
    client: TestClient, request, fixture_name: str, path: str
) -> None:
    response = client.get(path, headers=request.getfixturevalue(fixture_name))
    assert response.status_code == 200
