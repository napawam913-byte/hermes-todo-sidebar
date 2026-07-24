"""模块用途：执行任务级 mutation，并把规则变更交给规则调整服务。"""

from collections.abc import Callable
from datetime import datetime, timezone
import sqlite3
from zoneinfo import ZoneInfo

from ..contracts.content import serialize_validated_content
from ..contracts.mutations import (
    MutationError,
    TaskCreate,
    TaskDelete,
    TaskSetStatus,
    TaskUpdate,
)
from ..contracts.tasks import (
    GenerationMode,
    TaskKind,
    TaskStatus,
    format_utc,
)
from ..repositories.task_repository import TaskRepository
from .rule_adjustment import RuleAdjustmentService


ChangedIds = tuple[set[str], set[str]]


class TaskMutations:
    def __init__(
        self,
        repository: TaskRepository,
        rule_adjustment: RuleAdjustmentService,
        *,
        clock: Callable[[], datetime] | None = None,
    ) -> None:
        self._repository = repository
        self._rule_adjustment = rule_adjustment
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
        patch = operation.patch
        changed = set(patch.model_fields_set)
        changed_entries: set[str] = set()
        expected_version = operation.expectedVersion
        increment_version = True
        if "scheduleRule" in changed:
            if "generatedThroughDate" in changed or "generationMode" in changed:
                raise MutationError(
                    "validation_failed", target_id=operation.targetId
                )
            task = self._repository.get_task(connection, operation.targetId)
            if task is None:
                raise MutationError(
                    "target_missing", target_id=operation.targetId
                )
            if (
                task.kind is not TaskKind.CYCLE
                or task.status is not TaskStatus.ACTIVE
                or task.generation_mode is not GenerationMode.ROLLING
            ):
                raise MutationError(
                    "validation_failed", target_id=operation.targetId
                )
            result = self._rule_adjustment.replace_future(
                connection,
                task,
                patch.scheduleRule,
                expected_version,
                self._clock().astimezone(ZoneInfo("Asia/Shanghai")).date(),
            )
            changed_entries.update(result.addedEntryIds)
            changed_entries.update(result.removedEntryIds)
            changed.remove("scheduleRule")
            expected_version += 1
            increment_version = False
        if not changed:
            return {operation.targetId}, changed_entries
        assignments: list[str] = []
        values: list[object] = []
        if "content" in changed:
            assignments.append("content_json = ?")
            values.append(serialize_validated_content(patch.content))
        if "generationMode" in changed:
            assignments.append("generation_mode = ?")
            values.append(patch.generationMode.value)
        if "generatedThroughDate" in changed:
            assignments.append("generated_through_date = ?")
            values.append(
                patch.generatedThroughDate.isoformat()
                if patch.generatedThroughDate
                else None
            )
        if increment_version:
            assignments.append("version = version + 1")
        assignments.append("updated_at = ?")
        values.extend(
            [format_utc(self._clock()), operation.targetId, expected_version]
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
        return {operation.targetId}, changed_entries

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
