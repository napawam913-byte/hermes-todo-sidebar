"""模块用途：向 Hermes 注册受限的周期任务查询与提案生命周期工具。"""

from . import schemas, tools


TOOL_DEFINITIONS = (
    (schemas.TODAY, tools.get_today),
    (schemas.LIST, tools.list_cycle_plans),
    (schemas.GET, tools.get_cycle_plan),
    (schemas.PROPOSE_CREATE, tools.propose_create),
    (schemas.PROPOSE_ADJUST, tools.propose_adjust),
    (schemas.CONFIRM, tools.confirm_proposal),
    (schemas.CANCEL, tools.cancel_proposal),
)


def register(ctx) -> None:
    """注册七个工具；插件永远不开放桌面 mutation 接口。"""
    for schema, handler in TOOL_DEFINITIONS:
        ctx.register_tool(
            name=schema["name"],
            toolset="cycle_plan",
            schema=schema,
            handler=handler,
            description=schema["description"],
        )
