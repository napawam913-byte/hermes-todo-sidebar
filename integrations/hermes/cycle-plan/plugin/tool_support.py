"""模块用途：集中提供 Hermes 工具的会话、请求、幂等与 JSON 辅助函数。"""

from __future__ import annotations

import hashlib
import json

from .client import PlanApiClient


def session(kwargs: dict) -> str | None:
    value = kwargs.get("task_id")
    return value.strip() if isinstance(value, str) and value.strip() else None


def idempotency(
    action: str, session_id: str, args: dict, kwargs: dict
) -> str:
    call_id = kwargs.get("tool_call_id") or kwargs.get("call_id")
    if isinstance(call_id, str) and call_id.strip():
        seed = f"{session_id}:{action}:{call_id.strip()}"
    else:
        canonical = json.dumps(
            args, ensure_ascii=False, sort_keys=True, separators=(",", ":")
        )
        seed = f"{session_id}:{action}:{canonical}"
    digest = hashlib.sha256(seed.encode()).hexdigest()[:40]
    return f"hermes-{digest}"


def request_json(
    kwargs: dict,
    method: str,
    path: str,
    payload: dict | None = None,
) -> str:
    return to_json(request_dict(kwargs, method, path, payload))


def request_dict(
    kwargs: dict,
    method: str,
    path: str,
    payload: dict | None = None,
) -> dict:
    client = kwargs.get("_client") or PlanApiClient()
    return client.request(method, path, payload)


def object_at(value: dict, key: str) -> dict:
    return dict(require_object(value.get(key)))


def require_object(value: object) -> dict:
    if not isinstance(value, dict):
        raise ValueError("invalid_object")
    return value


def list_at(value: dict, key: str) -> list:
    result = value.get(key)
    if not isinstance(result, list):
        raise ValueError(f"invalid_{key}")
    return result


def text_at(value: dict, key: str) -> str:
    result = value.get(key)
    if not isinstance(result, str) or not result.strip():
        raise ValueError(f"invalid_{key}")
    return result.strip()


def integer_at(value: dict, key: str) -> int:
    result = value.get(key)
    if type(result) is not int or result < 1:
        raise ValueError(f"invalid_{key}")
    return result


def exception_json(error: Exception) -> str:
    code = str(error) if str(error) else "validation_failed"
    return error_json(code)


def error_json(code: str) -> str:
    return to_json({"ok": False, "error": {"code": code}})


def to_json(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
