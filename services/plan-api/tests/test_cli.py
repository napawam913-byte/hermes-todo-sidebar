"""模块用途：验证 Plan API 命令行入口和确定性 OpenAPI 导出。"""

import json
from pathlib import Path

import plan_api.cli as cli
from plan_api.cli import main


TOKEN_A = "a" * 64
TOKEN_B = "b" * 64


def test_migrate_creates_database_from_cli_environment(tmp_path, monkeypatch):
    database_path = tmp_path / "plan.db"
    monkeypatch.setenv("PLAN_DATABASE_PATH", str(database_path))
    monkeypatch.setenv("PLAN_DESKTOP_TOKEN", TOKEN_A)
    monkeypatch.setenv("PLAN_HERMES_TOKEN", TOKEN_B)

    assert main(["migrate"]) == 0

    assert database_path.exists()


def test_ensure_window_command_accepts_explicit_date(tmp_path, monkeypatch):
    monkeypatch.setenv("PLAN_DATABASE_PATH", str(tmp_path / "plan.db"))
    monkeypatch.setenv("PLAN_DESKTOP_TOKEN", TOKEN_A)
    monkeypatch.setenv("PLAN_HERMES_TOKEN", TOKEN_B)

    assert main(["ensure-window", "--date", "2026-07-24"]) == 0


def test_ensure_window_command_defaults_to_shanghai_date(
    tmp_path, monkeypatch
):
    seen = {}

    class FakeGenerator:
        def __init__(self, _database, _repository) -> None:
            pass

        def ensure_window(self, target_date):
            seen["target_date"] = target_date

    monkeypatch.setenv("PLAN_DATABASE_PATH", str(tmp_path / "plan.db"))
    monkeypatch.setenv("PLAN_DESKTOP_TOKEN", TOKEN_A)
    monkeypatch.setenv("PLAN_HERMES_TOKEN", TOKEN_B)
    monkeypatch.setattr(cli, "_shanghai_today", lambda: cli.date(2026, 7, 24))
    monkeypatch.setattr(cli, "RollingGenerator", FakeGenerator)

    assert main(["ensure-window"]) == 0

    assert seen == {"target_date": cli.date(2026, 7, 24)}


def test_backup_command_writes_backup(tmp_path, monkeypatch):
    database_path = tmp_path / "plan.db"
    backup_dir = tmp_path / "backups"
    monkeypatch.setenv("PLAN_DATABASE_PATH", str(database_path))
    monkeypatch.setenv("PLAN_DESKTOP_TOKEN", TOKEN_A)
    monkeypatch.setenv("PLAN_HERMES_TOKEN", TOKEN_B)

    assert main(["migrate"]) == 0
    assert main(["backup", "--backup-dir", str(backup_dir)]) == 0

    assert len(list(backup_dir.glob("plan-*.db"))) == 1


def test_export_openapi_is_deterministic(tmp_path, monkeypatch):
    monkeypatch.setenv("PLAN_DATABASE_PATH", str(tmp_path / "plan.db"))
    monkeypatch.setenv("PLAN_DESKTOP_TOKEN", TOKEN_A)
    monkeypatch.setenv("PLAN_HERMES_TOKEN", TOKEN_B)
    first = tmp_path / "first.json"
    second = tmp_path / "second.json"

    assert main(["export-openapi", "--output", str(first)]) == 0
    assert main(["export-openapi", "--output", str(second)]) == 0

    assert first.read_bytes() == second.read_bytes()
    assert json.loads(first.read_text(encoding="utf-8"))["openapi"] == "3.1.0"


def test_serve_command_uses_fixed_loopback_boundary(monkeypatch, tmp_path):
    captured = {}

    def fake_run(target, *, factory, host, port):
        captured.update({
            "target": target,
            "factory": factory,
            "host": host,
            "port": port,
        })

    monkeypatch.setattr("plan_api.cli.uvicorn.run", fake_run)
    monkeypatch.setenv("PLAN_DATABASE_PATH", str(tmp_path / "plan.db"))
    monkeypatch.setenv("PLAN_DESKTOP_TOKEN", TOKEN_A)
    monkeypatch.setenv("PLAN_HERMES_TOKEN", TOKEN_B)

    assert main(["serve"]) == 0

    assert captured == {
        "target": "plan_api.app:create_app",
        "factory": True,
        "host": "127.0.0.1",
        "port": 8743,
    }


def test_serve_command_rejects_custom_network_boundary(
    monkeypatch, tmp_path
) -> None:
    monkeypatch.setenv("PLAN_DATABASE_PATH", str(tmp_path / "plan.db"))
    monkeypatch.setenv("PLAN_DESKTOP_TOKEN", TOKEN_A)
    monkeypatch.setenv("PLAN_HERMES_TOKEN", TOKEN_B)

    try:
        main(["serve", "--host", "0.0.0.0"])
    except SystemExit as error:
        assert error.code == 2
    else:
        raise AssertionError("serve accepted a custom host")


def test_systemd_service_uses_supported_serve_command() -> None:
    service_path = (
        Path(__file__).resolve().parents[1]
        / "deploy"
        / "systemd"
        / "hermes-plan-api.service"
    )
    service = service_path.read_text(encoding="utf-8")

    assert "-m plan_api serve" in service
    assert "--host" not in service
    assert "--port" not in service
