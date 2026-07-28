"""Hermes 工具到真实 FastAPI/SQLite 提案确认链路的集成测试。"""

import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(REPO / "services" / "plan-api" / "src"))

from fastapi.testclient import TestClient  # noqa: E402
from plan_api.app import create_app  # noqa: E402
from plan_api.settings import Settings  # noqa: E402
from plugin import tools  # noqa: E402


HERMES_TOKEN = "integration-hermes-token"
DESKTOP_TOKEN = "integration-desktop-token"


def content(title: str) -> dict:
    return {
        "schemaVersion": 1,
        "kind": "learning.session",
        "title": title,
        "summary": "阅读并整理本节要点",
        "locale": "zh-CN",
        "sections": [],
    }


class TestClientAdapter:
    def __init__(self, client: TestClient) -> None:
        self.client = client

    def request(
        self, method: str, path: str, payload: dict | None = None
    ) -> dict:
        response = self.client.request(
            method,
            path,
            headers={"Authorization": f"Bearer {HERMES_TOKEN}"},
            json=payload,
        )
        response.raise_for_status()
        return response.json()


class PlanApiIntegrationTests(unittest.TestCase):
    def test_pending_proposal_writes_only_after_same_session_confirm(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as directory:
            app = create_app(
                Settings(
                    database_path=Path(directory) / "plan.db",
                    desktop_token=DESKTOP_TOKEN,
                    hermes_token=HERMES_TOKEN,
                )
            )
            with TestClient(app) as http:
                client = TestClientAdapter(http)
                proposal = json.loads(
                    tools.propose_create(
                        {
                            "summary": "创建两天教程学习计划",
                            "draft": {
                                "generation_mode": "fixed",
                                "content": content("教程学习计划"),
                                "entries": [
                                    {
                                        "scheduled_date": "2026-07-29",
                                        "content": content("学习第一节"),
                                    },
                                    {
                                        "scheduled_date": "2026-07-30",
                                        "content": content("学习第二节"),
                                    },
                                ],
                            },
                        },
                        task_id="session-integration",
                        tool_call_id="create-1",
                        _client=client,
                    )
                )

                before = client.request("GET", "/v1/tasks")
                self.assertEqual(proposal["status"], "pending")
                self.assertEqual(before["tasks"], [])

                applied = json.loads(
                    tools.confirm_proposal(
                        {"proposalId": proposal["id"]},
                        task_id="session-integration",
                        tool_call_id="confirm-1",
                        _client=client,
                    )
                )
                repeated = json.loads(
                    tools.confirm_proposal(
                        {"proposalId": proposal["id"]},
                        task_id="session-integration",
                        tool_call_id="confirm-2",
                        _client=client,
                    )
                )
                after = client.request("GET", "/v1/tasks")

                self.assertEqual(applied["proposal"]["status"], "applied")
                self.assertEqual(repeated["proposal"]["status"], "applied")
                self.assertEqual(len(after["tasks"]), 1)
                self.assertEqual(after["tasks"][0]["kind"], "cycle")
                self.assertEqual(len(after["tasks"][0]["entries"]), 2)


if __name__ == "__main__":
    unittest.main()
