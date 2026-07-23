from fastapi.testclient import TestClient
from plan_api.app import create_app
from plan_api.settings import Settings


def test_health_identifies_service(tmp_path):
    settings = Settings(
        database_path=tmp_path / "plan.db",
        desktop_token="desktop-test-token",
        hermes_token="hermes-test-token",
    )
    with TestClient(create_app(settings)) as client:
        response = client.get("/v1/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["service"] == "plan-api"
    assert payload["apiVersion"] == 1
