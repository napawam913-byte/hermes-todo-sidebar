"""Hermes 扩展清单、安装脚本与 Skill 行为边界的静态合同测试。"""

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class InstallContractTests(unittest.TestCase):
    def test_manifest_requires_plan_api_endpoint_and_secret_token(self) -> None:
        manifest = (ROOT / "plugin" / "plugin.yaml").read_text("utf-8")

        self.assertIn('version: "2.0.0"', manifest)
        self.assertIn("PLAN_API_BASE_URL", manifest)
        self.assertIn("PLAN_HERMES_TOKEN", manifest)

    def test_installer_copies_all_python_modules_and_checks_plan_api(self) -> None:
        script = (ROOT / "install.sh").read_text("utf-8")

        self.assertIn('"$ROOT_DIR/plugin/"*.py', script)
        self.assertIn("/v1/tasks", script)
        self.assertIn("PLAN_HERMES_TOKEN", script)
        self.assertNotIn("echo $PLAN_HERMES_TOKEN", script)

    def test_skill_keeps_chat_general_and_requires_explicit_confirmation(
        self,
    ) -> None:
        skill = (
            ROOT / "skill" / "cycle-plan" / "SKILL.md"
        ).read_text("utf-8")

        self.assertIn("普通讨论", skill)
        self.assertIn("cycle_plan_propose_create", skill)
        self.assertIn("cycle_plan_confirm", skill)
        self.assertIn("明确确认", skill)
        self.assertIn("同一会话", skill)


if __name__ == "__main__":
    unittest.main()
