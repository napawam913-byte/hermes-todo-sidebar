"""模块用途：验证 Plan API SQLite 备份的完整性与保留策略。"""

from datetime import datetime, timezone
import sqlite3

import plan_api.backup as backup_module
from plan_api.backup import create_backup
from plan_api.db.database import Database
from plan_api.db.migrations import apply_migrations


def test_create_backup_restores_integrity_checked_database(tmp_path) -> None:
    database = Database(tmp_path / "plan.db")
    apply_migrations(database)
    with database.connect() as connection:
        connection.execute(
            "UPDATE app_meta SET server_revision = 123, "
            "updated_at = '2026-07-24T00:00:00Z' WHERE id = 1"
        )

    backup_path = create_backup(database, tmp_path / "backups")

    assert backup_path.name.startswith("plan-")
    assert backup_path.suffix == ".db"
    with sqlite3.connect(backup_path) as restored:
        assert restored.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
        row = restored.execute(
            "SELECT server_revision FROM app_meta WHERE id = 1"
        ).fetchone()
    assert row == (123,)


def test_create_backup_does_not_overwrite_same_timestamp_backup(
    tmp_path, monkeypatch
) -> None:
    _freeze_backup_clock(monkeypatch)
    database = Database(tmp_path / "plan.db")
    apply_migrations(database)
    backup_dir = tmp_path / "backups"

    first = create_backup(database, backup_dir)
    with database.connect() as connection:
        connection.execute(
            "UPDATE app_meta SET server_revision = 456 WHERE id = 1"
        )
    second = create_backup(database, backup_dir)

    assert first != second
    assert first.exists()
    assert second.exists()
    assert len(list(backup_dir.glob("plan-*.db"))) == 2
    with sqlite3.connect(first) as first_backup:
        assert first_backup.execute(
            "SELECT server_revision FROM app_meta WHERE id = 1"
        ).fetchone() == (0,)
    with sqlite3.connect(second) as second_backup:
        assert second_backup.execute(
            "SELECT server_revision FROM app_meta WHERE id = 1"
        ).fetchone() == (456,)


def test_create_backup_prunes_oldest_same_timestamp_collision(
    tmp_path, monkeypatch
) -> None:
    _freeze_backup_clock(monkeypatch)
    database = Database(tmp_path / "plan.db")
    apply_migrations(database)
    backup_dir = tmp_path / "backups"

    first = create_backup(database, backup_dir, keep=2)
    second = create_backup(database, backup_dir, keep=2)
    third = create_backup(database, backup_dir, keep=2)

    assert not first.exists()
    assert second.exists()
    assert third.exists()
    assert sorted(backup_dir.glob("plan-*.db")) == [second, third]


def test_create_backup_keeps_only_newest_backups(tmp_path) -> None:
    database = Database(tmp_path / "plan.db")
    apply_migrations(database)
    backup_dir = tmp_path / "backups"
    backup_dir.mkdir()
    for day in range(1, 17):
        (backup_dir / f"plan-202607{day:02d}T000000Z.db").write_text(
            "old", encoding="utf-8"
        )

    created = create_backup(database, backup_dir, keep=14)

    backups = sorted(path.name for path in backup_dir.glob("plan-*.db"))
    assert len(backups) == 14
    assert "plan-20260701T000000Z.db" not in backups
    assert "plan-20260702T000000Z.db" not in backups
    assert created.name in backups
    assert not list(backup_dir.glob("*.tmp"))


def _freeze_backup_clock(monkeypatch) -> None:
    fixed = datetime(2026, 7, 27, 23, 54, tzinfo=timezone.utc)

    class FrozenDateTime(datetime):
        @classmethod
        def now(cls, tz=None):
            return fixed

    monkeypatch.setattr(backup_module, "datetime", FrozenDateTime)
