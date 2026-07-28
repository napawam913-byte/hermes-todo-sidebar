"""模块用途：定义 Plan API 内容、条目与周期任务的模型可见 JSON Schema。"""


def strict(required: list[str], properties: dict, **extra: object) -> dict:
    return {
        "type": "object",
        "additionalProperties": False,
        "required": required,
        "properties": properties,
        **extra,
    }


CONTENT_FIELD = strict(
    ["key", "label", "type", "value"],
    {
        "key": {"type": "string"},
        "label": {"type": "string"},
        "type": {"type": "string"},
        "value": {},
    },
)

CONTENT_ITEM = strict(
    ["title", "fields"],
    {
        "title": {"type": "string"},
        "fields": {
            "type": "array",
            "maxItems": 100,
            "items": CONTENT_FIELD,
        },
    },
)

CONTENT_SECTION = strict(
    ["id", "label", "layout", "fields", "items"],
    {
        "id": {"type": "string"},
        "label": {"type": "string"},
        "layout": {
            "type": "string",
            "enum": ["fields", "list", "markdown", "table"],
        },
        "fields": {
            "type": "array",
            "maxItems": 100,
            "items": CONTENT_FIELD,
        },
        "items": {
            "type": "array",
            "maxItems": 100,
            "items": CONTENT_ITEM,
        },
    },
)

CONTENT_DOCUMENT = strict(
    ["schemaVersion", "kind", "title", "summary", "locale", "sections"],
    {
        "schemaVersion": {"const": 1},
        "kind": {"type": "string"},
        "title": {"type": "string"},
        "summary": {"type": "string"},
        "locale": {"type": "string"},
        "sections": {
            "type": "array",
            "maxItems": 100,
            "items": CONTENT_SECTION,
        },
    },
)

CADENCE = {
    "oneOf": [
        strict(["type"], {"type": {"const": "daily"}}),
        strict(
            ["type", "weekdays"],
            {
                "type": {"const": "weekly"},
                "weekdays": {
                    "type": "array",
                    "minItems": 1,
                    "items": {"type": "integer", "minimum": 1, "maximum": 7},
                },
            },
        ),
    ]
}

SCHEDULE_SLOT = strict(
    ["slotKey", "cadence", "content"],
    {
        "slotKey": {"type": "string"},
        "cadence": CADENCE,
        "content": CONTENT_DOCUMENT,
    },
)

SCHEDULE_RULE = strict(
    ["schemaVersion", "timezone", "horizonDays", "slots"],
    {
        "schemaVersion": {"const": 1},
        "timezone": {"const": "Asia/Shanghai"},
        "horizonDays": {"const": 7},
        "slots": {
            "type": "array",
            "minItems": 1,
            "maxItems": 200,
            "items": SCHEDULE_SLOT,
        },
    },
)

ENTRY_DRAFT = strict(
    ["scheduled_date", "content"],
    {
        "scheduled_date": {
            "type": "string",
            "description": "YYYY-MM-DD 日期",
        },
        "content": CONTENT_DOCUMENT,
        "slot_key": {"type": ["string", "null"]},
        "is_overridden": {"type": "boolean"},
        "generation_revision": {"type": ["integer", "null"], "minimum": 1},
    },
)

TASK_DRAFT = strict(
    ["generation_mode", "content", "entries"],
    {
        "generation_mode": {
            "type": "string",
            "enum": ["fixed", "rolling"],
        },
        "content": CONTENT_DOCUMENT,
        "entries": {
            "type": "array",
            "maxItems": 50,
            "items": ENTRY_DRAFT,
        },
        "status": {
            "type": "string",
            "enum": ["active", "paused", "archived"],
        },
        "schedule_rule": SCHEDULE_RULE,
        "generated_through_date": {"type": ["string", "null"]},
        "rule_revision": {"type": "integer", "minimum": 1},
    },
)

TASK_PATCH = strict(
    [],
    {
        "content": CONTENT_DOCUMENT,
        "generationMode": {
            "type": "string",
            "enum": ["fixed", "rolling"],
        },
        "scheduleRule": SCHEDULE_RULE,
        "generatedThroughDate": {"type": ["string", "null"]},
    },
    minProperties=1,
)

ENTRY_PATCH = strict(
    [],
    {
        "scheduledDate": {"type": "string"},
        "content": CONTENT_DOCUMENT,
        "slotKey": {"type": ["string", "null"]},
        "isOverridden": {"type": "boolean"},
        "generationRevision": {"type": ["integer", "null"], "minimum": 1},
    },
    minProperties=1,
)
