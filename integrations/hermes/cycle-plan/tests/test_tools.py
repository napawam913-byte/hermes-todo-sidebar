"""Hermes 周期计划工具的参数校验、作用域与零文件写入测试。"""

import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from plugin.schemas import ADJUST_OPERATION  # noqa: E402
from plugin.tools import propose_adjust, propose_create  # noqa: E402


def content(title: str) -> dict:
    return {
        "schemaVersion": 1,
        "kind": "fitness.workout",
        "title": title,
        "summary": "三项训练内容",
        "locale": "zh-CN",
        "sections": [],
    }


def entry(target_date: str = "2026-07-29") -> dict:
    return {"scheduled_date": target_date, "content": content("力量训练")}


def create_args() -> dict:
    return {
        "summary": "创建一周入门健身计划",
        "draft": {
            "generation_mode": "fixed",
            "content": content("一周入门健身计划"),
            "entries": [entry()],
        },
    }


class FakeClient:
    def __init__(self) -> None:
        self.calls: list[tuple[str, str, dict | None]] = []

    def request(
        self, method: str, path: str, payload: dict | None = None
    ) -> dict:
        self.calls.append((method, path, payload))
        return {"id": "proposal-1", "status": "pending"}


class CreateProposalTests(unittest.TestCase):
    def test_returns_server_proposal_for_canonical_create(self) -> None:
        client = FakeClient()

        result = json.loads(
            propose_create(
                create_args(), task_id="session-1", _client=client
            )
        )

        self.assertEqual(result["status"], "pending")
        operation = client.calls[0][2]["operations"][0]
        self.assertEqual(operation["type"], "task.create")
        self.assertEqual(operation["draft"]["kind"], "cycle")
        self.assertEqual(operation["draft"]["entries"][0]["source"], "hermes")

    def test_rejects_invalid_date_before_calling_api(self) -> None:
        client = FakeClient()
        args = create_args()
        args["draft"]["entries"][0]["scheduled_date"] = "2026-02-30"

        result = json.loads(
            propose_create(args, task_id="session-1", _client=client)
        )

        self.assertEqual(result["error"]["code"], "validation_failed")
        self.assertEqual(client.calls, [])

    def test_rejects_unknown_fields_and_more_than_fifty_entries(self) -> None:
        client = FakeClient()
        unknown = create_args()
        unknown["draft"]["time"] = "17:00"
        too_many = create_args()
        too_many["draft"]["entries"] = [entry() for _ in range(51)]

        unknown_result = json.loads(
            propose_create(unknown, task_id="session-1", _client=client)
        )
        many_result = json.loads(
            propose_create(too_many, task_id="session-1", _client=client)
        )

        self.assertEqual(unknown_result["error"]["code"], "validation_failed")
        self.assertEqual(many_result["error"]["code"], "validation_failed")
        self.assertEqual(client.calls, [])

    def test_handlers_never_write_files(self) -> None:
        client = FakeClient()
        with tempfile.TemporaryDirectory() as directory:
            previous = os.getcwd()
            os.chdir(directory)
            try:
                with patch(
                    "builtins.open",
                    side_effect=AssertionError("unexpected file access"),
                ):
                    propose_create(
                        create_args(),
                        task_id="session-1",
                        _client=client,
                    )
                self.assertEqual(list(Path(directory).iterdir()), [])
            finally:
                os.chdir(previous)


class AdjustProposalTests(unittest.TestCase):
    def test_model_schema_uses_exact_operation_branches(self) -> None:
        branches = ADJUST_OPERATION["oneOf"]

        self.assertEqual(len(branches), 9)
        self.assertTrue(
            all(item["additionalProperties"] is False for item in branches)
        )
        self.assertTrue(all("type" in item["required"] for item in branches))

    def test_accepts_operations_scoped_to_target_task(self) -> None:
        client = FakeClient()
        args = {
            "summary": "增加一次力量训练",
            "targetTaskId": "cycle-1",
            "targetVersion": 3,
            "operations": [
                {
                    "type": "task.update",
                    "targetId": "cycle-1",
                    "expectedVersion": 3,
                    "patch": {"content": content("四练健身计划")},
                },
                {
                    "type": "entry.create",
                    "taskId": "cycle-1",
                    "draft": entry("2026-07-31"),
                },
            ],
        }

        result = json.loads(
            propose_adjust(args, task_id="session-1", _client=client)
        )

        self.assertEqual(result["status"], "pending")
        payload = client.calls[0][2]
        self.assertEqual(payload["targetTaskId"], "cycle-1")
        self.assertEqual(payload["targetVersion"], 3)
        self.assertEqual(
            payload["operations"][1]["draft"]["source"], "hermes"
        )

    def test_rejects_other_task_and_more_than_fifty_operations(self) -> None:
        client = FakeClient()
        other = {
            "summary": "越权",
            "targetTaskId": "cycle-1",
            "targetVersion": 3,
            "operations": [
                {
                    "type": "task.setStatus",
                    "targetId": "cycle-2",
                    "expectedVersion": 3,
                    "status": "paused",
                }
            ],
        }
        too_many = {
            "summary": "过多",
            "targetTaskId": "cycle-1",
            "targetVersion": 3,
            "operations": [
                {
                    "type": "entry.complete",
                    "targetId": f"entry-{index}",
                    "expectedVersion": 1,
                }
                for index in range(51)
            ],
        }

        other_result = json.loads(
            propose_adjust(other, task_id="session-1", _client=client)
        )
        many_result = json.loads(
            propose_adjust(too_many, task_id="session-1", _client=client)
        )

        self.assertEqual(other_result["error"]["code"], "validation_failed")
        self.assertEqual(many_result["error"]["code"], "validation_failed")
        self.assertEqual(client.calls, [])


if __name__ == "__main__":
    unittest.main()
