"""模块用途：提供 Plan API 部署、维护和 OpenAPI 合同导出的命令行入口。"""

from argparse import ArgumentParser, Namespace
from datetime import date
import json
from pathlib import Path

import uvicorn

from .app import create_app
from .backup import create_backup
from .db.database import Database
from .db.migrations import apply_migrations
from .repositories.task_repository import TaskRepository
from .services.rolling_generator import RollingGenerator
from .settings import Settings


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    settings = Settings.from_env()
    database = Database(settings.database_path)
    if args.command == "serve":
        return _serve(args)
    if args.command == "migrate":
        apply_migrations(database)
        return 0
    if args.command == "ensure-window":
        _ensure_window(database, args.target_date)
        return 0
    if args.command == "backup":
        apply_migrations(database)
        backup_dir = _backup_dir(args.backup_dir, settings.database_path)
        create_backup(database, backup_dir, keep=args.keep)
        return 0
    if args.command == "export-openapi":
        _export_openapi(settings, args.output)
        return 0
    raise SystemExit(f"unsupported command: {args.command}")


def _parser() -> ArgumentParser:
    parser = ArgumentParser(prog="plan-api")
    subcommands = parser.add_subparsers(dest="command", required=True)

    serve = subcommands.add_parser("serve")
    serve.add_argument("--host", default="127.0.0.1")
    serve.add_argument("--port", type=int, default=8743)

    subcommands.add_parser("migrate")

    ensure = subcommands.add_parser("ensure-window")
    ensure.add_argument(
        "--date",
        dest="target_date",
        type=date.fromisoformat,
        default=date.today(),
    )

    backup = subcommands.add_parser("backup")
    backup.add_argument("--backup-dir", type=Path)
    backup.add_argument("--keep", type=int, default=14)

    export = subcommands.add_parser("export-openapi")
    export.add_argument("--output", type=Path, required=True)
    return parser


def _serve(args: Namespace) -> int:
    uvicorn.run(
        "plan_api.app:create_app",
        factory=True,
        host=args.host,
        port=args.port,
    )
    return 0


def _ensure_window(database: Database, target_date: date) -> None:
    apply_migrations(database)
    RollingGenerator(database, TaskRepository()).ensure_window(target_date)


def _backup_dir(configured: Path | None, database_path: Path) -> Path:
    if configured is not None:
        return configured
    return database_path.parent / "backups"


def _export_openapi(settings: Settings, output: Path) -> None:
    app = create_app(settings)
    payload = json.dumps(
        app.openapi(),
        ensure_ascii=False,
        indent=2,
        sort_keys=True,
    )
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(f"{payload}\n", encoding="utf-8")
