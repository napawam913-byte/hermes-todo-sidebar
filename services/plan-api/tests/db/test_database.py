import sqlite3

import pytest

from plan_api.db.database import Database
from plan_api.db.migrations import apply_migrations


def test_connect_configures_sqlite_pragmas(tmp_path) -> None:
    database = Database(tmp_path / "nested" / "plan.db")

    with database.connect() as connection:
        assert connection.execute("PRAGMA foreign_keys").fetchone()[0] == 1
        assert connection.execute("PRAGMA busy_timeout").fetchone()[0] == 5000
        assert connection.execute("PRAGMA journal_mode").fetchone()[0] == "wal"
        assert isinstance(
            connection.execute("SELECT 1").fetchone(), sqlite3.Row
        )


def test_transaction_rolls_back_on_failure(tmp_path) -> None:
    database = Database(tmp_path / "plan.db")
    with database.connect() as connection:
        connection.execute("CREATE TABLE markers (value TEXT NOT NULL)")

    with pytest.raises(RuntimeError, match="stop"):
        with database.transaction() as connection:
            connection.execute("INSERT INTO markers VALUES ('partial')")
            raise RuntimeError("stop")

    with database.connect() as connection:
        count = connection.execute("SELECT COUNT(*) FROM markers").fetchone()[0]
    assert count == 0


def test_task_delete_cascades_to_entries(tmp_path) -> None:
    database = _migrated_database(tmp_path)
    with database.transaction() as connection:
        _insert_task(connection)
        _insert_entry(connection, entry_id="entry-1", slot_key=None)
        connection.execute("DELETE FROM tasks WHERE id = 'task-1'")

    with database.connect() as connection:
        count = connection.execute(
            "SELECT COUNT(*) FROM task_entries"
        ).fetchone()[0]
    assert count == 0


def test_generated_slot_is_unique_but_null_slots_can_repeat(tmp_path) -> None:
    database = _migrated_database(tmp_path)
    with database.transaction() as connection:
        _insert_task(connection)
        _insert_entry(connection, entry_id="manual-1", slot_key=None)
        _insert_entry(connection, entry_id="manual-2", slot_key=None)
        _insert_entry(connection, entry_id="generated-1", slot_key="strength")

    with pytest.raises(sqlite3.IntegrityError):
        with database.transaction() as connection:
            _insert_entry(
                connection, entry_id="generated-2", slot_key="strength"
            )


def _migrated_database(tmp_path) -> Database:
    database = Database(tmp_path / "plan.db")
    apply_migrations(database)
    return database


def _insert_task(connection: sqlite3.Connection) -> None:
    connection.execute(
        """
        INSERT INTO tasks (
            id, kind, status, generation_mode, content_json,
            schedule_rule_json, generated_through_date, rule_revision,
            version, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            "task-1",
            "cycle",
            "active",
            "rolling",
            "{}",
            "{}",
            None,
            1,
            1,
            "2026-07-23T00:00:00Z",
            "2026-07-23T00:00:00Z",
        ),
    )


def _insert_entry(
    connection: sqlite3.Connection, *, entry_id: str, slot_key: str | None
) -> None:
    connection.execute(
        """
        INSERT INTO task_entries (
            id, task_id, scheduled_date, status, content_json, source,
            slot_key, is_overridden, generation_revision, version,
            created_at, updated_at, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            entry_id,
            "task-1",
            "2026-07-24",
            "pending",
            "{}",
            "rule_generated" if slot_key else "manual",
            slot_key,
            0,
            1 if slot_key else None,
            1,
            "2026-07-23T00:00:00Z",
            "2026-07-23T00:00:00Z",
            None,
        ),
    )
