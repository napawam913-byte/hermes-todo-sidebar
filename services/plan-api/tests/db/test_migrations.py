from pathlib import Path
import sqlite3

import pytest

from plan_api.db.database import Database
from plan_api.db import migrations
from plan_api.db.migrations import apply_migrations


EXPECTED_COLUMNS = {
    "tasks": (
        "id kind status generation_mode content_json schedule_rule_json "
        "generated_through_date rule_revision version created_at updated_at"
    ).split(),
    "task_entries": (
        "id task_id scheduled_date status content_json source slot_key "
        "is_overridden generation_revision version created_at updated_at "
        "completed_at"
    ).split(),
    "agent_sessions": "id external_session_id created_at updated_at".split(),
    "agent_proposals": (
        "id session_id proposal_json status expires_at target_task_id "
        "target_version idempotency_key created_at updated_at applied_at"
    ).split(),
    "audit_events": (
        "id actor action target_type target_id proposal_id result_json created_at"
    ).split(),
    "schema_migrations": "version checksum applied_at".split(),
    "app_meta": "id server_revision updated_at".split(),
    "idempotency_records": (
        "idempotency_key request_hash response_json created_at"
    ).split(),
}


def test_initial_migration_creates_all_tables_and_exact_columns(tmp_path) -> None:
    database = Database(tmp_path / "plan.db")
    apply_migrations(database)

    with database.connect() as connection:
        tables = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            )
            if not row[0].startswith("sqlite_")
        }
        assert tables == set(EXPECTED_COLUMNS)
        for table, expected in EXPECTED_COLUMNS.items():
            columns = [
                row["name"]
                for row in connection.execute(f"PRAGMA table_info({table})")
            ]
            assert columns == expected
        assert connection.execute(
            "SELECT server_revision FROM app_meta WHERE id = 1"
        ).fetchone()[0] == 0


@pytest.mark.parametrize(
    ("table", "check"),
    [
        ("tasks", "kind IN ('daily', 'cycle')"),
        ("tasks", "status IN ('active', 'paused', 'archived')"),
        ("tasks", "generation_mode IN ('fixed', 'rolling')"),
        ("task_entries", "status IN ('pending', 'completed', 'skipped')"),
        (
            "task_entries",
            "source IN ('manual', 'rule_generated', 'hermes')",
        ),
        (
            "agent_proposals",
            "status IN ('pending', 'applied', 'cancelled', 'expired', 'failed')",
        ),
    ],
)
def test_schema_declares_exact_approved_enum_checks(
    tmp_path, table: str, check: str
) -> None:
    database = Database(tmp_path / "plan.db")
    apply_migrations(database)

    with database.connect() as connection:
        sql = connection.execute(
            "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?",
            (table,),
        ).fetchone()[0]
    assert f"CHECK ({check})" in sql


def test_migrations_run_in_lexical_order(tmp_path, monkeypatch) -> None:
    migration_dir = tmp_path / "sql"
    migration_dir.mkdir()
    _write(
        migration_dir / "010_finish.sql",
        "INSERT INTO migration_order VALUES ('010');",
    )
    _write(
        migration_dir / "001_metadata.sql",
        """
        CREATE TABLE schema_migrations (
            version TEXT PRIMARY KEY,
            checksum TEXT NOT NULL,
            applied_at TEXT NOT NULL
        );
        CREATE TABLE migration_order (version TEXT NOT NULL);
        """,
    )
    _write(
        migration_dir / "002_middle.sql",
        "INSERT INTO migration_order VALUES ('002');",
    )
    monkeypatch.setattr(
        migrations, "_migration_files", lambda: list(migration_dir.iterdir())
    )
    database = Database(tmp_path / "plan.db")

    apply_migrations(database)

    with database.connect() as connection:
        order = [
            row[0]
            for row in connection.execute(
                "SELECT version FROM migration_order ORDER BY rowid"
            )
        ]
    assert order == ["002", "010"]


def test_applied_migration_checksum_is_verified(tmp_path, monkeypatch) -> None:
    migration = tmp_path / "001_metadata.sql"
    _write(
        migration,
        """
        CREATE TABLE schema_migrations (
            version TEXT PRIMARY KEY,
            checksum TEXT NOT NULL,
            applied_at TEXT NOT NULL
        );
        """,
    )
    monkeypatch.setattr(migrations, "_migration_files", lambda: [migration])
    database = Database(tmp_path / "plan.db")
    apply_migrations(database)
    migration.write_text(
        migration.read_text(encoding="utf-8") + "SELECT 1;\n",
        encoding="utf-8",
    )

    with pytest.raises(RuntimeError, match="migration_checksum_mismatch"):
        apply_migrations(database)


def test_failed_migration_rolls_back_sql_and_record(
    tmp_path, monkeypatch
) -> None:
    initial = tmp_path / "001_metadata.sql"
    failing = tmp_path / "002_failing.sql"
    _write(
        initial,
        """
        CREATE TABLE schema_migrations (
            version TEXT PRIMARY KEY,
            checksum TEXT NOT NULL,
            applied_at TEXT NOT NULL
        );
        """,
    )
    _write(
        failing,
        """
        CREATE TABLE partial_table (id TEXT);
        INSERT INTO missing_table VALUES ('failure');
        """,
    )
    monkeypatch.setattr(
        migrations, "_migration_files", lambda: [failing, initial]
    )
    database = Database(tmp_path / "plan.db")

    with pytest.raises(sqlite3.OperationalError):
        apply_migrations(database)

    with database.connect() as connection:
        tables = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            )
        }
        applied = [
            row[0]
            for row in connection.execute(
                "SELECT version FROM schema_migrations ORDER BY version"
            )
        ]
    assert "partial_table" not in tables
    assert applied == ["001_metadata"]


@pytest.mark.parametrize(
    "trailing_sql",
    [
        "   \n\t",
        "-- trailing line comment; with semicolons;",
        "/* trailing block comment */",
        "/* trailing block comment; with semicolons; */",
    ],
)
def test_migration_allows_trailing_whitespace_and_comments(
    tmp_path, monkeypatch, trailing_sql: str
) -> None:
    migration = tmp_path / "001_metadata.sql"
    migration.write_text(
        """
        CREATE TABLE schema_migrations (
            version TEXT PRIMARY KEY,
            checksum TEXT NOT NULL,
            applied_at TEXT NOT NULL
        );
        """.strip()
        + "\n"
        + trailing_sql,
        encoding="utf-8",
    )
    monkeypatch.setattr(migrations, "_migration_files", lambda: [migration])
    database = Database(tmp_path / "plan.db")

    apply_migrations(database)

    with database.connect() as connection:
        applied = connection.execute(
            "SELECT version FROM schema_migrations"
        ).fetchall()
    assert [row["version"] for row in applied] == ["001_metadata"]


@pytest.mark.parametrize(
    "incomplete_sql",
    [
        "/* unterminated; block comment",
        "CREATE TABLE broken (",
    ],
)
def test_incomplete_migration_rolls_back_sql_and_record(
    tmp_path, monkeypatch, incomplete_sql: str
) -> None:
    initial = tmp_path / "001_metadata.sql"
    failing = tmp_path / "002_failing.sql"
    _write(
        initial,
        """
        CREATE TABLE schema_migrations (
            version TEXT PRIMARY KEY,
            checksum TEXT NOT NULL,
            applied_at TEXT NOT NULL
        );
        """,
    )
    _write(
        failing,
        f"""
        CREATE TABLE partial_table (id TEXT);
        {incomplete_sql}
        """,
    )
    monkeypatch.setattr(
        migrations, "_migration_files", lambda: [failing, initial]
    )
    database = Database(tmp_path / "plan.db")

    with pytest.raises(RuntimeError, match="incomplete_migration_statement"):
        apply_migrations(database)

    with database.connect() as connection:
        tables = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            )
        }
        applied = [
            row[0]
            for row in connection.execute(
                "SELECT version FROM schema_migrations ORDER BY version"
            )
        ]
    assert "partial_table" not in tables
    assert applied == ["001_metadata"]


def _write(path: Path, sql: str) -> None:
    path.write_text(sql.strip() + "\n", encoding="utf-8")
