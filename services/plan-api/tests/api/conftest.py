from collections.abc import Iterator

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from plan_api.app import create_app
from plan_api.settings import Settings


DESKTOP_TOKEN = "desktop-api-test-token"
HERMES_TOKEN = "hermes-api-test-token"


@pytest.fixture
def app(tmp_path) -> FastAPI:
    return create_app(
        Settings(
            database_path=tmp_path / "plan.db",
            desktop_token=DESKTOP_TOKEN,
            hermes_token=HERMES_TOKEN,
        )
    )


@pytest.fixture
def client(app: FastAPI) -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def desktop_headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {DESKTOP_TOKEN}"}


@pytest.fixture
def hermes_headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {HERMES_TOKEN}"}
