"""模块用途：校验 Hermes 调整提案只作用于指定周期任务及其条目。"""

from __future__ import annotations

from .validation import (
    TASK_STATUSES,
    ValidationError,
    array,
    choice,
    content,
    entry,
    entry_patch,
    exact,
    exact_operation,
    positive_int,
    text,
)


ENTRY_ACTIONS = {
    "entry.complete",
    "entry.reopen",
    "entry.skip",
    "entry.delete",
}


def normalize_adjust_args(
    value: object,
) -> tuple[str, str, int, list[dict]]:
    root = exact(
        value,
        {"summary", "targetTaskId", "targetVersion", "operations"},
    )
    target_id = text(root["targetTaskId"], "targetTaskId")
    version = positive_int(root["targetVersion"], "targetVersion")
    operations = array(root["operations"], "operations", 50)
    if not operations:
        raise ValidationError("operations_required")
    normalized = [
        _operation(item, target_id, version) for item in operations
    ]
    return text(root["summary"], "summary"), target_id, version, normalized


def _operation(
    value: object, target_id: str, target_version: int
) -> dict:
    item = exact(value, set(value) if isinstance(value, dict) else set())
    operation_type = text(item.get("type"), "type")
    if operation_type == "task.update":
        result = exact_operation(
            item, {"targetId", "expectedVersion", "patch"}
        )
        _task_target(result, target_id, target_version)
        result["patch"] = _task_patch(result["patch"])
        return result
    if operation_type == "task.setStatus":
        result = exact_operation(
            item, {"targetId", "expectedVersion", "status"}
        )
        _task_target(result, target_id, target_version)
        result["status"] = choice(result["status"], TASK_STATUSES)
        return result
    if operation_type == "task.delete":
        result = exact_operation(
            item, {"targetId", "expectedVersion"}
        )
        _task_target(result, target_id, target_version)
        return result
    if operation_type == "entry.create":
        result = exact_operation(item, {"taskId", "draft"})
        if text(result["taskId"], "taskId") != target_id:
            raise ValidationError("target_scope_violation")
        result["draft"] = entry(result["draft"])
        return result
    if operation_type == "entry.update":
        result = exact_operation(
            item, {"targetId", "expectedVersion", "patch"}
        )
        _entry_target(result)
        result["patch"] = entry_patch(result["patch"])
        return result
    if operation_type in ENTRY_ACTIONS:
        result = exact_operation(
            item, {"targetId", "expectedVersion"}
        )
        _entry_target(result)
        return result
    raise ValidationError("operation_not_allowed")


def _task_patch(value: object) -> dict:
    patch = exact(
        value,
        {
            "content",
            "generationMode",
            "scheduleRule",
            "generatedThroughDate",
        },
        {
            "content",
            "generationMode",
            "scheduleRule",
            "generatedThroughDate",
        },
    )
    if not patch:
        raise ValidationError("empty_patch")
    if "content" in patch:
        patch["content"] = content(patch["content"])
    return patch


def _task_target(value: dict, target_id: str, version: int) -> None:
    if text(value["targetId"], "targetId") != target_id:
        raise ValidationError("target_scope_violation")
    if positive_int(value["expectedVersion"], "expectedVersion") != version:
        raise ValidationError("target_version_mismatch")


def _entry_target(value: dict) -> None:
    value["targetId"] = text(value["targetId"], "targetId")
    value["expectedVersion"] = positive_int(
        value["expectedVersion"], "expectedVersion"
    )
