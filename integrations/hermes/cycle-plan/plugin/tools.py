"""模块用途：把 Hermes 工具调用编排为受会话约束的 Plan API 请求。"""

from __future__ import annotations

from urllib.parse import quote

from .client import PlanApiError
from .tool_support import (
    error_json,
    exception_json,
    idempotency,
    object_at,
    request_dict,
    request_json,
    require_object,
    session,
    text_at,
    to_json,
)
from .adjust_validation import normalize_adjust_args
from .create_validation import normalize_create_args
from .validation import ValidationError, iso_date


def propose_create(args: dict, **kwargs: object) -> str:
    """创建周期任务提案；只生成 pending 提案，不直接写入任务。"""
    session_id = session(kwargs)
    if session_id is None:
        return error_json("missing_session_context")
    try:
        summary, draft = normalize_create_args(args)
        entries = draft["entries"]
        task_draft = {
            **draft,
            "kind": "cycle",
            "entries": [
                {**require_object(item), "source": "hermes"}
                for item in entries
            ],
        }
        payload = {
            "externalSessionId": session_id,
            "idempotencyKey": idempotency(
                "create", session_id, args, kwargs
            ),
            "summary": summary,
            "operations": [
                {"type": "task.create", "draft": task_draft}
            ],
        }
        return request_json(kwargs, "POST", "/v1/proposals", payload)
    except ValidationError:
        return error_json("validation_failed")
    except (PlanApiError, TypeError, ValueError) as error:
        return exception_json(error)


def propose_adjust(args: dict, **kwargs: object) -> str:
    """为指定周期任务创建受限调整提案。"""
    session_id = session(kwargs)
    if session_id is None:
        return error_json("missing_session_context")
    try:
        summary, target_id, target_version, operations = (
            normalize_adjust_args(args)
        )
        payload = {
            "externalSessionId": session_id,
            "idempotencyKey": idempotency(
                "adjust", session_id, args, kwargs
            ),
            "summary": summary,
            "operations": [
                _normalize_adjust_operation(item)
                for item in operations
            ],
            "targetTaskId": target_id,
            "targetVersion": target_version,
        }
        return request_json(kwargs, "POST", "/v1/proposals", payload)
    except ValidationError:
        return error_json("validation_failed")
    except (PlanApiError, TypeError, ValueError) as error:
        return exception_json(error)


def confirm_proposal(args: dict, **kwargs: object) -> str:
    """使用当前 Hermes 会话确认并原子应用提案。"""
    return _transition("confirm", args, kwargs)


def cancel_proposal(args: dict, **kwargs: object) -> str:
    """使用当前 Hermes 会话取消待确认提案。"""
    return _transition("cancel", args, kwargs)


def list_cycle_plans(args: dict, **kwargs: object) -> str:
    """读取紧凑周期任务列表，供用户选择调整目标。"""
    del args
    if session(kwargs) is None:
        return error_json("missing_session_context")
    try:
        response = request_dict(kwargs, "GET", "/v1/tasks")
        plans = []
        for task in response.get("tasks", []):
            if not isinstance(task, dict) or task.get("kind") != "cycle":
                continue
            content = task.get("content")
            title = content.get("title") if isinstance(content, dict) else ""
            entries = task.get("entries")
            plans.append(
                {
                    "id": task.get("id"),
                    "title": title,
                    "status": task.get("status"),
                    "version": task.get("version"),
                    "entryCount": len(entries) if isinstance(entries, list) else 0,
                }
            )
        return to_json({"plans": plans})
    except (PlanApiError, TypeError, ValueError) as error:
        return exception_json(error)


def get_cycle_plan(args: dict, **kwargs: object) -> str:
    """读取一个周期任务完整快照，供调整提案引用版本。"""
    if session(kwargs) is None:
        return error_json("missing_session_context")
    try:
        task_id = quote(text_at(args, "taskId"), safe="")
        result = request_dict(kwargs, "GET", f"/v1/tasks/{task_id}")
        if result.get("kind") != "cycle":
            return error_json("target_not_cycle")
        return to_json(result)
    except (PlanApiError, TypeError, ValueError) as error:
        return exception_json(error)


def get_today(args: dict, **kwargs: object) -> str:
    """读取指定日期的今日待办，不修改任何任务。"""
    if session(kwargs) is None:
        return error_json("missing_session_context")
    try:
        target_date = quote(iso_date(args.get("date")), safe="")
        return request_json(kwargs, "GET", f"/v1/today?date={target_date}")
    except ValidationError:
        return error_json("validation_failed")
    except (PlanApiError, TypeError, ValueError) as error:
        return exception_json(error)


def _transition(action: str, args: dict, kwargs: dict) -> str:
    session_id = session(kwargs)
    if session_id is None:
        return error_json("missing_session_context")
    try:
        proposal_id = quote(text_at(args, "proposalId"), safe="")
        payload = {
            "externalSessionId": session_id,
            "idempotencyKey": idempotency(
                action, session_id, args, kwargs
            ),
        }
        path = f"/v1/proposals/{proposal_id}/{action}"
        return request_json(kwargs, "POST", path, payload)
    except (PlanApiError, TypeError, ValueError) as error:
        return exception_json(error)


def _normalize_adjust_operation(value: object) -> dict:
    operation = dict(require_object(value))
    if operation.get("type") == "entry.create":
        draft = object_at(operation, "draft")
        operation["draft"] = {**draft, "source": "hermes"}
    return operation
