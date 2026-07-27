# 用途：验证 Plan API 迁移的升级、校验和与失败回滚；边界：不重复初始 schema 合同断言。
from pathlib import Path
import sqlite3

import pytest

from plan_api.db.database import Database
from plan_api.db import migrations
from plan_api.db.migrations import apply_migrations


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


def test_failed_migration_rolls_back_sql_and_record(tmp_path, monkeypatch) -> None:
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
    ["/* unterminated; block comment", "CREATE TABLE broken ("],
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
