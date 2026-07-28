"""模块用途：校验并规范化 Hermes 新建周期任务提案参数。"""

from __future__ import annotations

from .validation import (
    TASK_STATUSES,
    ValidationError,
    array,
    choice,
    content,
    entry,
    exact,
    text,
)


def normalize_create_args(value: object) -> tuple[str, dict]:
    root = exact(value, {"summary", "draft"})
    draft = exact(
        root["draft"],
        {
            "generation_mode",
            "content",
            "entries",
            "status",
            "schedule_rule",
            "generated_through_date",
            "rule_revision",
        },
        {
            "status",
            "schedule_rule",
            "generated_through_date",
            "rule_revision",
        },
    )
    mode = choice(draft["generation_mode"], {"fixed", "rolling"})
    entries = array(draft["entries"], "entries", 50)
    result = {
        "generation_mode": mode,
        "content": content(draft["content"]),
        "entries": [entry(item) for item in entries],
    }
    if "status" in draft:
        result["status"] = choice(draft["status"], TASK_STATUSES)
    for key in ("schedule_rule", "generated_through_date", "rule_revision"):
        if key in draft:
            result[key] = draft[key]
    if mode == "fixed" and "schedule_rule" in result:
        raise ValidationError("fixed_rejects_schedule_rule")
    if mode == "rolling" and "schedule_rule" not in result:
        raise ValidationError("rolling_requires_schedule_rule")
    return text(root["summary"], "summary"), result
