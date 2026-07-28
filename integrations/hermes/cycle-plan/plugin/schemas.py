"""模块用途：定义 Hermes 周期任务查询、提案、确认和取消工具 Schema。"""

from .data_schemas import ENTRY_DRAFT, ENTRY_PATCH, TASK_DRAFT, TASK_PATCH
from .data_schemas import strict


def operation(operation_type: str, fields: dict, required: list[str]) -> dict:
    return strict(
        ["type", *required],
        {"type": {"const": operation_type}, **fields},
    )


TARGET_VERSION = {
    "targetId": {"type": "string"},
    "expectedVersion": {"type": "integer", "minimum": 1},
}

ADJUST_OPERATION = {
    "description": "只允许修改目标周期任务及其日期条目。",
    "oneOf": [
        operation(
            "task.update",
            {**TARGET_VERSION, "patch": TASK_PATCH},
            ["targetId", "expectedVersion", "patch"],
        ),
        operation(
            "task.setStatus",
            {
                **TARGET_VERSION,
                "status": {
                    "type": "string",
                    "enum": ["active", "paused", "archived"],
                },
            },
            ["targetId", "expectedVersion", "status"],
        ),
        operation(
            "task.delete",
            TARGET_VERSION,
            ["targetId", "expectedVersion"],
        ),
        operation(
            "entry.create",
            {"taskId": {"type": "string"}, "draft": ENTRY_DRAFT},
            ["taskId", "draft"],
        ),
        operation(
            "entry.update",
            {**TARGET_VERSION, "patch": ENTRY_PATCH},
            ["targetId", "expectedVersion", "patch"],
        ),
        *[
            operation(
                action,
                TARGET_VERSION,
                ["targetId", "expectedVersion"],
            )
            for action in (
                "entry.complete",
                "entry.reopen",
                "entry.skip",
                "entry.delete",
            )
        ],
    ],
}


def tool(name: str, description: str, parameters: dict) -> dict:
    return {
        "name": name,
        "description": description,
        "parameters": parameters,
    }


EMPTY_PARAMETERS = strict([], {})

TODAY = tool(
    "cycle_plan_today",
    "读取指定日期的今日待办，不修改数据。",
    strict(
        ["date"],
        {"date": {"type": "string", "description": "YYYY-MM-DD 日期"}},
    ),
)

LIST = tool(
    "cycle_plan_list",
    "列出紧凑周期任务摘要，用于选择调整目标。",
    EMPTY_PARAMETERS,
)

GET = tool(
    "cycle_plan_get",
    "读取指定周期任务及条目的完整快照和版本。",
    strict(["taskId"], {"taskId": {"type": "string"}}),
)

PROPOSE_CREATE = tool(
    "cycle_plan_propose_create",
    "创建待确认的周期任务提案，不直接写入任务。",
    strict(
        ["summary", "draft"],
        {
            "summary": {"type": "string"},
            "draft": TASK_DRAFT,
        },
    ),
)

PROPOSE_ADJUST = tool(
    "cycle_plan_propose_adjust",
    "为指定周期任务创建待确认的受限调整提案。",
    strict(
        ["summary", "targetTaskId", "targetVersion", "operations"],
        {
            "summary": {"type": "string"},
            "targetTaskId": {"type": "string"},
            "targetVersion": {"type": "integer", "minimum": 1},
            "operations": {
                "type": "array",
                "minItems": 1,
                "maxItems": 50,
                "items": ADJUST_OPERATION,
            },
        },
    ),
)

CONFIRM = tool(
    "cycle_plan_confirm",
    "在用户明确确认后，原子应用当前会话中的指定提案。",
    strict(["proposalId"], {"proposalId": {"type": "string"}}),
)

CANCEL = tool(
    "cycle_plan_cancel",
    "取消当前会话中尚未应用的指定提案。",
    strict(["proposalId"], {"proposalId": {"type": "string"}}),
)
