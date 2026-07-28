"""Hermes Plugin 工具注册与模型可见 Schema 的合同测试。"""

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from plugin import register  # noqa: E402
from plugin.schemas import PROPOSE_CREATE  # noqa: E402


class FakeContext:
    def __init__(self) -> None:
        self.tools: list[dict] = []

    def register_tool(self, **kwargs: object) -> None:
        self.tools.append(kwargs)


class PluginRegistrationTests(unittest.TestCase):
    def test_registers_only_seven_scoped_cycle_plan_tools(self) -> None:
        context = FakeContext()

        register(context)

        self.assertEqual(
            {item["name"] for item in context.tools},
            {
                "cycle_plan_today",
                "cycle_plan_list",
                "cycle_plan_get",
                "cycle_plan_propose_create",
                "cycle_plan_propose_adjust",
                "cycle_plan_confirm",
                "cycle_plan_cancel",
            },
        )
        self.assertTrue(
            all(item["toolset"] == "cycle_plan" for item in context.tools)
        )

    def test_create_schema_exposes_database_contract_not_old_ui_blocks(
        self,
    ) -> None:
        parameters = PROPOSE_CREATE["parameters"]
        draft = parameters["properties"]["draft"]
        entry = draft["properties"]["entries"]["items"]

        self.assertFalse(parameters["additionalProperties"])
        self.assertEqual(
            set(draft["required"]),
            {"generation_mode", "content", "entries"},
        )
        self.assertIn("scheduled_date", entry["required"])
        self.assertNotIn("contentBlocks", entry["properties"])
        self.assertNotIn("kind", draft["properties"])
        self.assertNotIn("source", entry["properties"])


if __name__ == "__main__":
    unittest.main()
