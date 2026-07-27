import sqlite3

from ..contracts.mutations import MutationError


def require_expected_revision(
    connection: sqlite3.Connection,
    expected: int | None,
) -> None:
    if expected is None:
        return
    row = connection.execute(
        "SELECT server_revision FROM app_meta WHERE id = 1"
    ).fetchone()
    if row is None or int(row["server_revision"]) != expected:
        raise MutationError("version_conflict")
