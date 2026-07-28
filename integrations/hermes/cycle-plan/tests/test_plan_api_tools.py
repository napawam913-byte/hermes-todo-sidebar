"""Hermes 周期计划工具到 Plan API 的请求合同测试。"""

import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from plugin import tools  # noqa: E402


def content(title: str) -> dict:
    return {
        "schemaVersion": 1,
        "kind": "fitness.workout",
        "title": title,
        "summary": "三项训练内容",
        "locale": "zh-CN",
        "sections": [],
    }


class FakeClient:
    def __init__(self, response: dict) -> None:
        self.response = response
        self.calls: list[tuple[str, str, dict | None]] = []

    def request(
        self, method: str, path: str, payload: dict | None = None
    ) -> dict:
        self.calls.append((method, path, payload))
        return self.response


class PlanApiToolTests(unittest.TestCase):
    def test_create_posts_cycle_proposal_bound_to_hermes_task(self) -> None:
        client = FakeClient({"id": "proposal-1", "status": "pending"})
        args = {
            "summary": "创建一周健身计划",
            "draft": {
                "generation_mode": "fixed",
                "content": content("一周健身计划"),
                "entries": [
                    {
                        "scheduled_date": "2026-07-29",
                        "content": content("第一次训练"),
                    }
                ],
            },
        }

        result = json.loads(
            tools.propose_create(
                args, task_id="session-1", _client=client
            )
        )

        self.assertEqual(result["status"], "pending")
        method, path, payload = client.calls[0]
        self.assertEqual((method, path), ("POST", "/v1/proposals"))
        self.assertEqual(payload["externalSessionId"], "session-1")
        operation = payload["operations"][0]
        self.assertEqual(operation["type"], "task.create")
        self.assertEqual(operation["draft"]["kind"], "cycle")
        self.assertEqual(
            operation["draft"]["entries"][0]["source"], "hermes"
        )

    def test_missing_task_context_never_calls_plan_api(self) -> None:
        client = FakeClient({})

        result = json.loads(
            tools.propose_create(
                {"summary": "x", "draft": {}}, _client=client
            )
        )

        self.assertEqual(
            result["error"]["code"], "missing_session_context"
        )
        self.assertEqual(client.calls, [])

    def test_confirm_and_cancel_use_same_hermes_session(self) -> None:
        client = FakeClient({"id": "proposal-1", "status": "applied"})

        tools.confirm_proposal(
            {"proposalId": "proposal-1"},
            task_id="session-1",
            _client=client,
        )
        tools.cancel_proposal(
            {"proposalId": "proposal-2"},
            task_id="session-1",
            _client=client,
        )

        confirm = client.calls[0]
        cancel = client.calls[1]
        self.assertEqual(
            confirm[:2],
            ("POST", "/v1/proposals/proposal-1/confirm"),
        )
        self.assertEqual(
            cancel[:2],
            ("POST", "/v1/proposals/proposal-2/cancel"),
        )
        self.assertEqual(
            confirm[2]["externalSessionId"], "session-1"
        )
        self.assertEqual(cancel[2]["externalSessionId"], "session-1")

    def test_cycle_list_returns_only_compact_cycle_summaries(self) -> None:
        client = FakeClient(
            {
                "tasks": [
                    {
                        "id": "daily-1",
                        "kind": "daily",
                        "status": "active",
                        "version": 1,
                        "content": content("普通待办"),
                        "entries": [],
                    },
                    {
                        "id": "cycle-1",
                        "kind": "cycle",
                        "status": "active",
                        "version": 3,
                        "content": content("健身计划"),
                        "entries": [{}, {}],
                    },
                ]
            }
        )

        result = json.loads(
            tools.list_cycle_plans({}, task_id="session-1", _client=client)
        )

        self.assertEqual(
            result,
            {
                "plans": [
                    {
                        "id": "cycle-1",
                        "title": "健身计划",
                        "status": "active",
                        "version": 3,
                        "entryCount": 2,
                    }
                ]
            },
        )

    def test_today_rejects_invalid_calendar_date_without_api_call(self) -> None:
        client = FakeClient({})

        result = json.loads(
            tools.get_today(
                {"date": "2026-02-30"},
                task_id="session-1",
                _client=client,
            )
        )

        self.assertEqual(result["error"]["code"], "validation_failed")
        self.assertEqual(client.calls, [])

    def test_cycle_detail_reads_only_requested_task_snapshot(self) -> None:
        client = FakeClient(
            {
                "id": "cycle/one",
                "kind": "cycle",
                "content": content("健身计划"),
                "entries": [],
            }
        )

        result = json.loads(
            tools.get_cycle_plan(
                {"taskId": "cycle/one"},
                task_id="session-1",
                _client=client,
            )
        )

        self.assertEqual(result["id"], "cycle/one")
        self.assertEqual(
            client.calls[0][:2],
            ("GET", "/v1/tasks/cycle%2Fone"),
        )


if __name__ == "__main__":
    unittest.main()
