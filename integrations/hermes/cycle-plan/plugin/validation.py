"""模块用途：提供周期任务工具共用的严格字段、内容和日期校验。"""

from __future__ import annotations

from datetime import date


class ValidationError(ValueError):
    """表示模型参数不符合周期任务工具合同。"""


TASK_STATUSES = {"active", "paused", "archived"}


def entry(value: object) -> dict:
    item = exact(
        value,
        {
            "scheduled_date",
            "content",
            "slot_key",
            "is_overridden",
            "generation_revision",
        },
        {"slot_key", "is_overridden", "generation_revision"},
    )
    result = {
        "scheduled_date": iso_date(item["scheduled_date"]),
        "content": content(item["content"]),
    }
    for key in ("slot_key", "is_overridden", "generation_revision"):
        if key in item:
            result[key] = item[key]
    return result


def entry_patch(value: object) -> dict:
    patch = exact(
        value,
        {
            "scheduledDate",
            "content",
            "slotKey",
            "isOverridden",
            "generationRevision",
        },
        {
            "scheduledDate",
            "content",
            "slotKey",
            "isOverridden",
            "generationRevision",
        },
    )
    if not patch:
        raise ValidationError("empty_patch")
    if "scheduledDate" in patch:
        patch["scheduledDate"] = iso_date(patch["scheduledDate"])
    if "content" in patch:
        patch["content"] = content(patch["content"])
    return patch


def content(value: object) -> dict:
    result = exact(
        value,
        {"schemaVersion", "kind", "title", "summary", "locale", "sections"},
    )
    if result["schemaVersion"] != 1:
        raise ValidationError("invalid_schema_version")
    for key in ("kind", "title", "summary", "locale"):
        result[key] = text(result[key], key)
    result["sections"] = array(result["sections"], "sections", 100)
    return result


def exact_operation(value: dict, fields: set[str]) -> dict:
    result = exact(value, {"type", *fields})
    result["type"] = value["type"]
    return result


def exact(
    value: object,
    allowed: set[str],
    optional: set[str] | frozenset[str] = frozenset(),
) -> dict:
    result = object_value(value)
    if set(result) - allowed:
        raise ValidationError("unknown_field")
    if (allowed - optional) - set(result):
        raise ValidationError("missing_field")
    return dict(result)


def object_value(value: object) -> dict:
    if not isinstance(value, dict):
        raise ValidationError("invalid_object")
    return value


def array(value: object, field: str, limit: int) -> list:
    if not isinstance(value, list) or len(value) > limit:
        raise ValidationError(f"invalid_{field}")
    return value


def text(value: object, field: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValidationError(f"invalid_{field}")
    return value.strip()


def positive_int(value: object, field: str) -> int:
    if type(value) is not int or value < 1:
        raise ValidationError(f"invalid_{field}")
    return value


def choice(value: object, choices: set[str]) -> str:
    result = text(value, "choice")
    if result not in choices:
        raise ValidationError("invalid_choice")
    return result


def iso_date(value: object) -> str:
    result = text(value, "date")
    try:
        parsed = date.fromisoformat(result)
    except ValueError as error:
        raise ValidationError("invalid_date") from error
    if parsed.isoformat() != result:
        raise ValidationError("invalid_date")
    return result
