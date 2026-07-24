import pytest
from fastapi.security import HTTPAuthorizationCredentials

from plan_api.api.auth import resolve_role
from plan_api.api.errors import ApiError
from plan_api.app import create_app
from plan_api.settings import Settings


def test_duplicate_tokens_are_rejected_at_startup(tmp_path) -> None:
    settings = Settings(
        database_path=tmp_path / "plan.db",
        desktop_token="same-token",
        hermes_token="same-token",
    )
    with pytest.raises(ValueError, match="distinct"):
        create_app(settings)


@pytest.mark.parametrize(
    ("desktop_token", "hermes_token"),
    [("", "hermes-token"), ("desktop-token", "")],
)
def test_empty_tokens_are_rejected_at_startup(
    tmp_path, desktop_token: str, hermes_token: str
) -> None:
    settings = Settings(
        database_path=tmp_path / "plan.db",
        desktop_token=desktop_token,
        hermes_token=hermes_token,
    )
    with pytest.raises(ValueError, match="empty"):
        create_app(settings)


def test_non_ascii_invalid_token_returns_401(tmp_path) -> None:
    settings = Settings(
        database_path=tmp_path / "plan.db",
        desktop_token="desktop-token",
        hermes_token="hermes-token",
    )
    credentials = HTTPAuthorizationCredentials(
        scheme="Bearer", credentials="不是有效令牌"
    )
    with pytest.raises(ApiError) as exc_info:
        resolve_role(credentials, settings)
    assert exc_info.value.status_code == 401
    assert exc_info.value.code == "invalid_token"
