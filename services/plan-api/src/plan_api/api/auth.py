from enum import Enum
import secrets

from fastapi.security import HTTPAuthorizationCredentials

from ..settings import Settings
from .errors import ApiError


class TokenRole(str, Enum):
    DESKTOP = "desktop"
    HERMES = "hermes"


def resolve_role(
    credentials: HTTPAuthorizationCredentials | None,
    settings: Settings,
) -> TokenRole:
    if credentials is None:
        raise ApiError(401, "missing_token")

    token = credentials.credentials
    desktop_matches = secrets.compare_digest(token, settings.desktop_token)
    hermes_matches = secrets.compare_digest(token, settings.hermes_token)
    if desktop_matches:
        return TokenRole.DESKTOP
    if hermes_matches:
        return TokenRole.HERMES
    raise ApiError(401, "invalid_token")
