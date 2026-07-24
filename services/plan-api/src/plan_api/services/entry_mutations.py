from collections.abc import Callable
from datetime import datetime, timezone
import sqlite3
from uuid import uuid4

from ..contracts.content import serialize_validated_content
from ..contracts.mutations import (
    EntryComplete,
    EntryCreate,
    EntryDelete,
    EntryReopen,
    EntrySkip,
    EntryUpdate,
    MutationError,
)
from ..contracts.tasks import format_utc
from .task_mutations import ChangedIds, _require_write


class EntryMutations:
    def __init__(
        self,
        *,
        clock: Callable[[], datetime] | None = None,
        id_factory: Callable[[], str] | None = None,
    ) -> None:
        self._clock = clock or (lambda: datetime.now(timezone.utc))
        self._id_factory = id_factory or (lambda: uuid4().hex)

    def create(
        self, connection: sqlite3.Connection, operation: EntryCreate
    ) -> ChangedIds:
        task = connection.execute(
            "SELECT kind FROM tasks WHERE id = ?", (operation.taskId,)
        ).fetchone()
        if task is None:
            raise MutationError("target_missing", target_id=operation.taskId)
        if task["kind"] == "daily":
            raise MutationError("validation_failed", target_id=operation.taskId)
        entry_id = self._id_factory()
        now = format_utc(self._clock())
        self._insert(connection, operation, entry_id, now)
        return {operation.taskId}, {entry_id}

    def _insert(
        self,
        connection: sqlite3.Connection,
        operation: EntryCreate,
        entry_id: str,
        now: str,
    ) -> None:
        draft = operation.draft
        try:
            connection.execute(
                """
                INSERT INTO task_entries (
                    id, task_id, scheduled_date, status, content_json, source,
                    slot_key, is_overridden, generation_revision, version,
                    created_at, updated_at, completed_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
                """,
                (
                    entry_id,
                    operation.taskId,
                    draft.scheduled_date.isoformat(),
                    draft.status.value,
                    serialize_validated_content(draft.content),
                    draft.source.value,
                    draft.slot_key,
                    int(draft.is_overridden),
                    draft.generation_revision,
                    now,
                    now,
                    format_utc(draft.completed_at) if draft.completed_at else None,
                ),
            )
        except sqlite3.IntegrityError as error:
            raise MutationError(
                "validation_failed", message=str(error)
            ) from error

    def update(
        self, connection: sqlite3.Connection, operation: EntryUpdate
    ) -> ChangedIds:
        task_id = _entry_task(connection, operation.targetId)
        assignments: list[str] = []
        values: list[object] = []
        patch = operation.patch
        changed = patch.model_fields_set
        mapping = {
            "scheduledDate": ("scheduled_date", _date_value),
            "content": ("content_json", serialize_validated_content),
            "source": ("source", lambda value: value.value),
            "slotKey": ("slot_key", _identity),
            "isOverridden": ("is_overridden", int),
            "generationRevision": ("generation_revision", _identity),
        }
        for field in changed:
            column, convert = mapping[field]
            assignments.append(f"{column} = ?")
            values.append(convert(getattr(patch, field)))
        assignments.extend(["version = version + 1", "updated_at = ?"])
        values.extend(
            [format_utc(self._clock()), operation.targetId, operation.expectedVersion]
        )
        try:
            cursor = connection.execute(
                f"""
                UPDATE task_entries SET {", ".join(assignments)}
                WHERE id = ? AND version = ?
                """,
                values,
            )
        except sqlite3.IntegrityError as error:
            raise MutationError(
                "validation_failed", message=str(error)
            ) from error
        _require_write(
            connection, "task_entries", operation.targetId, cursor.rowcount
        )
        return {task_id}, {operation.targetId}

    def complete(
        self, connection: sqlite3.Connection, operation: EntryComplete
    ) -> ChangedIds:
        now = format_utc(self._clock())
        return self._set_status(
            connection, operation.targetId, operation.expectedVersion,
            status="completed", completed_at=now,
        )

    def reopen(
        self, connection: sqlite3.Connection, operation: EntryReopen
    ) -> ChangedIds:
        return self._set_status(
            connection, operation.targetId, operation.expectedVersion,
            status="pending", completed_at=None,
        )

    def skip(
        self, connection: sqlite3.Connection, operation: EntrySkip
    ) -> ChangedIds:
        return self._set_status(
            connection, operation.targetId, operation.expectedVersion,
            status="skipped", completed_at=None,
        )

    def delete(
        self, connection: sqlite3.Connection, operation: EntryDelete
    ) -> ChangedIds:
        row = connection.execute(
            """
            SELECT e.task_id, e.version, t.kind
            FROM task_entries e JOIN tasks t ON t.id = e.task_id
            WHERE e.id = ?
            """,
            (operation.targetId,),
        ).fetchone()
        if row is None:
            raise MutationError("target_missing", target_id=operation.targetId)
        if row["version"] != operation.expectedVersion:
            raise MutationError("version_conflict", target_id=operation.targetId)
        if row["kind"] == "daily":
            raise MutationError("validation_failed", target_id=operation.targetId)
        cursor = connection.execute(
            "DELETE FROM task_entries WHERE id = ? AND version = ?",
            (operation.targetId, operation.expectedVersion),
        )
        _require_write(
            connection, "task_entries", operation.targetId, cursor.rowcount
        )
        return {str(row["task_id"])}, {operation.targetId}

    def _set_status(
        self,
        connection: sqlite3.Connection,
        target_id: str,
        expected_version: int,
        *,
        status: str,
        completed_at: str | None,
    ) -> ChangedIds:
        task_id = _entry_task(connection, target_id)
        cursor = connection.execute(
            """
            UPDATE task_entries
            SET status = ?, completed_at = ?, version = version + 1,
                updated_at = ?
            WHERE id = ? AND version = ?
            """,
            (
                status,
                completed_at,
                format_utc(self._clock()),
                target_id,
                expected_version,
            ),
        )
        _require_write(connection, "task_entries", target_id, cursor.rowcount)
        return {task_id}, {target_id}


def _entry_task(connection: sqlite3.Connection, target_id: str) -> str:
    row = connection.execute(
        "SELECT task_id FROM task_entries WHERE id = ?", (target_id,)
    ).fetchone()
    if row is None:
        raise MutationError("target_missing", target_id=target_id)
    return str(row["task_id"])


def _date_value(value) -> str:
    return value.isoformat()


def _identity(value):
    return value
