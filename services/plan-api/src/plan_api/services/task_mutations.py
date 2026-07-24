from collections.abc import Callable
from datetime import datetime, timezone
import sqlite3

from ..contracts.content import serialize_validated_content
from ..contracts.mutations import (
    MutationError,
    TaskCreate,
    TaskDelete,
    TaskSetStatus,
    TaskUpdate,
)
from ..contracts.schedule_rules import serialize_validated_schedule_rule
from ..contracts.tasks import format_utc
from ..repositories.task_repository import TaskRepository


ChangedIds = tuple[set[str], set[str]]


class TaskMutations:
    def __init__(
        self,
        repository: TaskRepository,
        *,
        clock: Callable[[], datetime] | None = None,
    ) -> None:
        self._repository = repository
        self._clock = clock or (lambda: datetime.now(timezone.utc))

    def create(
        self, connection: sqlite3.Connection, operation: TaskCreate
    ) -> ChangedIds:
        try:
            task_id = self._repository.insert_task(connection, operation.draft)
        except sqlite3.IntegrityError as error:
            raise MutationError(
                "validation_failed", message=str(error)
            ) from error
        task = self._repository.get_task(connection, task_id)
        assert task is not None
        return {task_id}, {entry.id for entry in task.entries}

    def update(
        self, connection: sqlite3.Connection, operation: TaskUpdate
    ) -> ChangedIds:
        assignments: list[str] = []
        values: list[object] = []
        patch = operation.patch
        changed = patch.model_fields_set
        if "content" in changed:
            assignments.append("content_json = ?")
            values.append(serialize_validated_content(patch.content))
        if "generationMode" in changed:
            assignments.append("generation_mode = ?")
            values.append(patch.generationMode.value)
        if "scheduleRule" in changed:
            assignments.extend(
                ["schedule_rule_json = ?", "rule_revision = rule_revision + 1"]
            )
            values.append(serialize_validated_schedule_rule(patch.scheduleRule))
        if "generatedThroughDate" in changed:
            assignments.append("generated_through_date = ?")
            values.append(
                patch.generatedThroughDate.isoformat()
                if patch.generatedThroughDate
                else None
            )
        assignments.extend(["version = version + 1", "updated_at = ?"])
        values.extend(
            [format_utc(self._clock()), operation.targetId, operation.expectedVersion]
        )
        cursor = connection.execute(
            f"""
            UPDATE tasks SET {", ".join(assignments)}
            WHERE id = ? AND version = ?
            """,
            values,
        )
        _require_write(
            connection, "tasks", operation.targetId, cursor.rowcount
        )
        return {operation.targetId}, set()

    def set_status(
        self, connection: sqlite3.Connection, operation: TaskSetStatus
    ) -> ChangedIds:
        cursor = connection.execute(
            """
            UPDATE tasks
            SET status = ?, version = version + 1, updated_at = ?
            WHERE id = ? AND version = ?
            """,
            (
                operation.status.value,
                format_utc(self._clock()),
                operation.targetId,
                operation.expectedVersion,
            ),
        )
        _require_write(
            connection, "tasks", operation.targetId, cursor.rowcount
        )
        return {operation.targetId}, set()

    def delete(
        self, connection: sqlite3.Connection, operation: TaskDelete
    ) -> ChangedIds:
        entry_ids = {
            str(row["id"])
            for row in connection.execute(
                "SELECT id FROM task_entries WHERE task_id = ?",
                (operation.targetId,),
            )
        }
        cursor = connection.execute(
            "DELETE FROM tasks WHERE id = ? AND version = ?",
            (operation.targetId, operation.expectedVersion),
        )
        _require_write(
            connection, "tasks", operation.targetId, cursor.rowcount
        )
        return {operation.targetId}, entry_ids


def _require_write(
    connection: sqlite3.Connection,
    table: str,
    target_id: str,
    rowcount: int,
) -> None:
    if rowcount:
        return
    row = connection.execute(
        f"SELECT version FROM {table} WHERE id = ?", (target_id,)
    ).fetchone()
    code = "target_missing" if row is None else "version_conflict"
    raise MutationError(code, target_id=target_id)
