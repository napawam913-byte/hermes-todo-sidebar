"""Plan API 客户端的鉴权、地址归一化与错误边界测试。"""

import io
import json
import sys
import unittest
from pathlib import Path
from urllib.error import HTTPError
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from plugin.client import PlanApiClient, PlanApiError  # noqa: E402


class FakeResponse:
    def __init__(self, payload: dict) -> None:
        self._body = json.dumps(payload, ensure_ascii=False).encode("utf-8")

    def __enter__(self) -> "FakeResponse":
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def read(self) -> bytes:
        return self._body


class CaptureOpener:
    def __init__(self, payload: dict) -> None:
        self.payload = payload
        self.request = None
        self.timeout = None

    def __call__(self, request, *, timeout: float) -> FakeResponse:
        self.request = request
        self.timeout = timeout
        return FakeResponse(self.payload)


class PlanApiClientTests(unittest.TestCase):
    def test_normalizes_v1_base_and_sends_utf8_bearer_request(self) -> None:
        opener = CaptureOpener({"status": "pending"})
        client = PlanApiClient(
            "https://plan.example/v1/",
            "secret-token",
            opener=opener,
        )

        result = client.request(
            "POST",
            "/v1/proposals",
            {"summary": "创建健身计划"},
        )

        self.assertEqual(result, {"status": "pending"})
        self.assertEqual(
            opener.request.full_url,
            "https://plan.example/v1/proposals",
        )
        self.assertEqual(
            opener.request.get_header("Authorization"),
            "Bearer secret-token",
        )
        self.assertEqual(
            json.loads(opener.request.data.decode("utf-8"))["summary"],
            "创建健身计划",
        )

    def test_maps_api_error_code_without_exposing_token(self) -> None:
        def failing_opener(request, *, timeout):
            del request, timeout
            body = io.BytesIO(b'{"code":"version_conflict"}')
            raise HTTPError(
                "https://plan.example/v1/proposals",
                409,
                "Conflict",
                {},
                body,
            )

        client = PlanApiClient(
            "https://plan.example",
            "secret-token",
            opener=failing_opener,
        )

        with self.assertRaisesRegex(PlanApiError, "^version_conflict$"):
            client.request("POST", "/v1/proposals", {})

    def test_missing_token_fails_before_network_call(self) -> None:
        opener = CaptureOpener({})
        with patch.dict(
            "os.environ",
            {"PLAN_HERMES_TOKEN": "unexpected-environment-token"},
        ):
            client = PlanApiClient(
                "https://plan.example",
                "",
                opener=opener,
            )

            with self.assertRaisesRegex(
                PlanApiError, "plan_api_token_missing"
            ):
                client.request("GET", "/v1/tasks")

        self.assertIsNone(opener.request)


if __name__ == "__main__":
    unittest.main()
