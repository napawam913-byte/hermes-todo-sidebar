from collections.abc import Iterator
from datetime import datetime, timezone
import hashlib
from importlib.resources import files
from importlib.resources.abc import Traversable
import re
import sqlite3

from .database import Database


MIGRATION_NAME = re.compile(r"^\d+_[a-z0-9_]+\.sql$")


def apply_migrations(database: Database) -> None:
    for migration in sorted(_migration_files(), key=lambda item: item.name):
        content = migration.read_bytes()
        checksum = hashlib.sha256(content).hexdigest()
        version = migration.name.removesuffix(".sql")

        with database.transaction() as connection:
            applied_checksum = _applied_checksum(connection, version)
            if applied_checksum is not None:
                if applied_checksum != checksum:
                    raise RuntimeError("migration_checksum_mismatch")
                continue

            for statement in _statements(content.decode("utf-8")):
                connection.execute(statement)
            connection.execute(
                """
                INSERT INTO schema_migrations (version, checksum, applied_at)
                VALUES (?, ?, ?)
                """,
                (version, checksum, _utc_now()),
            )


def _migration_files() -> list[Traversable]:
    sql_directory = files("plan_api").joinpath("db", "sql")
    return [
        item
        for item in sql_directory.iterdir()
        if item.is_file() and MIGRATION_NAME.fullmatch(item.name)
    ]


def _applied_checksum(
    connection: sqlite3.Connection, version: str
) -> str | None:
    migration_table = connection.execute(
        """
        SELECT 1
        FROM sqlite_master
        WHERE type = 'table' AND name = 'schema_migrations'
        """
    ).fetchone()
    if migration_table is None:
        return None
    row = connection.execute(
        "SELECT checksum FROM schema_migrations WHERE version = ?",
        (version,),
    ).fetchone()
    return None if row is None else str(row["checksum"])


def _statements(sql: str) -> Iterator[str]:
    buffer: list[str] = []
    for character in sql:
        buffer.append(character)
        if character != ";":
            continue
        candidate = "".join(buffer).strip()
        if sqlite3.complete_statement(candidate):
            yield candidate
            buffer.clear()

    remainder = "".join(buffer)
    if not _is_comment_only(remainder):
        raise RuntimeError("incomplete_migration_statement")


def _is_comment_only(sql: str) -> bool:
    position = 0
    while position < len(sql):
        if sql[position].isspace():
            position += 1
            continue
        if sql.startswith("--", position):
            line_end = sql.find("\n", position + 2)
            if line_end == -1:
                return True
            position = line_end + 1
            continue
        if sql.startswith("/*", position):
            comment_end = sql.find("*/", position + 2)
            if comment_end == -1:
                return False
            position = comment_end + 2
            continue
        return False
    return True


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
