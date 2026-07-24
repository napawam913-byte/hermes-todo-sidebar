from enum import Enum
import secrets

from fastapi.security import HTTPAuthorizationCredentials

from ..settings import Settings
from .errors import ApiError


class TokenRole(str, Enum):
    DESKTOP = "desktop"
    HERMES = "hermes"


def validate_token_settings(settings: Settings) -> None:
    desktop_token = _token_bytes(settings.desktop_token)
    hermes_token = _token_bytes(settings.hermes_token)
    if not desktop_token or not hermes_token:
        raise ValueError("api_tokens_must_not_be_empty")
    if secrets.compare_digest(desktop_token, hermes_token):
        raise ValueError("api_tokens_must_be_distinct")


def resolve_role(
    credentials: HTTPAuthorizationCredentials | None,
    settings: Settings,
) -> TokenRole:
    if credentials is None:
        raise ApiError(401, "missing_token")

    token = _token_bytes(credentials.credentials)
    desktop_matches = secrets.compare_digest(
        token, _token_bytes(settings.desktop_token)
    )
    hermes_matches = secrets.compare_digest(
        token, _token_bytes(settings.hermes_token)
    )
    if desktop_matches:
        return TokenRole.DESKTOP
    if hermes_matches:
        return TokenRole.HERMES
    raise ApiError(401, "invalid_token")


def _token_bytes(token: str) -> bytes:
    return token.encode("utf-8")
