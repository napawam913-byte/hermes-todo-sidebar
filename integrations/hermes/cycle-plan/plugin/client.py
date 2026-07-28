"""模块用途：封装 Hermes 周期计划工具访问 Plan API 的受限 HTTP 边界。"""

from __future__ import annotations

import json
import os
from typing import Callable
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


class PlanApiClient:
    """只负责带 Hermes Token 调用 Plan API，不承载计划业务逻辑。"""

    def __init__(
        self,
        base_url: str | None = None,
        token: str | None = None,
        *,
        timeout: float = 20.0,
        opener: Callable[..., object] = urlopen,
    ) -> None:
        configured_url = (
            base_url
            if base_url is not None
            else os.environ.get("PLAN_API_BASE_URL", "")
        ).rstrip("/")
        self._base_url = (
            configured_url[:-3]
            if configured_url.endswith("/v1")
            else configured_url
        )
        self._token = (
            token
            if token is not None
            else os.environ.get("PLAN_HERMES_TOKEN", "")
        )
        self._timeout = timeout
        self._opener = opener

    def request(
        self,
        method: str,
        path: str,
        payload: dict | None = None,
    ) -> dict:
        if not self._base_url:
            raise PlanApiError("plan_api_not_configured")
        if not self._token:
            raise PlanApiError("plan_api_token_missing")
        body = None
        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {self._token}",
        }
        if payload is not None:
            body = json.dumps(
                payload,
                ensure_ascii=False,
                separators=(",", ":"),
            ).encode("utf-8")
            headers["Content-Type"] = "application/json; charset=utf-8"
        request = Request(
            f"{self._base_url}/{path.lstrip('/')}",
            data=body,
            headers=headers,
            method=method.upper(),
        )
        try:
            with self._opener(request, timeout=self._timeout) as response:
                return _decode_response(response.read())
        except HTTPError as error:
            raise _http_error(error) from None
        except URLError as error:
            raise PlanApiError("plan_api_unreachable") from error


class PlanApiError(RuntimeError):
    """向工具层暴露稳定错误码，避免泄露 Token 或底层网络细节。"""


def _decode_response(raw: bytes) -> dict:
    try:
        value = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise PlanApiError("invalid_plan_api_response") from error
    if not isinstance(value, dict):
        raise PlanApiError("invalid_plan_api_response")
    return value


def _http_error(error: HTTPError) -> PlanApiError:
    try:
        payload = _decode_response(error.read())
        code = payload.get("code")
    except PlanApiError:
        code = None
    return PlanApiError(
        str(code) if isinstance(code, str) else f"plan_api_http_{error.code}"
    )
