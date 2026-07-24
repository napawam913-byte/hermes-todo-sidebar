"""模块用途：在调用方事务内替换任务未来规则条目并重建七天窗口。"""

from collections.abc import Callable
from datetime import date, datetime, timezone
import sqlite3

from pydantic import BaseModel, ConfigDict, Field

from ..contracts.mutations import MutationError
from ..contracts.schedule_rules import (
    ScheduleRuleV1,
    serialize_validated_schedule_rule,
)
from ..contracts.tasks import TaskView, format_utc
from ..repositories.task_repository import TaskRepository
from .rolling_generator import RollingGenerator


class RuleAdjustmentResult(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    added: int = Field(ge=0)
    removed: int = Field(ge=0)
    replaced: int = Field(ge=0)
    addedEntryIds: tuple[str, ...] = ()
    removedEntryIds: tuple[str, ...] = ()


class RuleAdjustmentService:
    def __init__(
        self,
        repository: TaskRepository,
        generator: RollingGenerator,
        *,
        clock: Callable[[], datetime] | None = None,
    ) -> None:
        self._repository = repository
        self._generator = generator
        self._clock = clock or (lambda: datetime.now(timezone.utc))

    def replace_future(
        self,
        connection: sqlite3.Connection,
        task: TaskView,
        new_rule: ScheduleRuleV1 | None,
        expected_version: int,
        today: date,
    ) -> RuleAdjustmentResult:
        if task.version != expected_version:
            raise MutationError("version_conflict", target_id=task.id)
        serialized_rule = serialize_validated_schedule_rule(new_rule)
        removed_ids = self._replaceable_ids(connection, task, today)
        connection.execute(
            """
            DELETE FROM task_entries
            WHERE task_id = ? AND scheduled_date >= ?
              AND status = 'pending' AND source = 'rule_generated'
              AND is_overridden = 0 AND generation_revision = ?
            """,
            (task.id, today.isoformat(), task.rule_revision),
        )
        cursor = connection.execute(
            """
            UPDATE tasks
            SET schedule_rule_json = ?, rule_revision = ?,
                version = version + 1, updated_at = ?
            WHERE id = ? AND version = ?
            """,
            (
                serialized_rule,
                task.rule_revision + 1,
                format_utc(self._clock()),
                task.id,
                expected_version,
            ),
        )
        self._require_task_write(connection, task.id, cursor.rowcount)
        updated = self._repository.get_task(connection, task.id)
        assert updated is not None
        added_ids = self._generator.ensure_task_window(
            connection, updated, new_rule, today
        )
        return RuleAdjustmentResult(
            added=len(added_ids),
            removed=len(removed_ids),
            replaced=min(len(added_ids), len(removed_ids)),
            addedEntryIds=added_ids,
            removedEntryIds=removed_ids,
        )

    @staticmethod
    def _replaceable_ids(
        connection: sqlite3.Connection,
        task: TaskView,
        today: date,
    ) -> tuple[str, ...]:
        rows = connection.execute(
            """
            SELECT id FROM task_entries
            WHERE task_id = ? AND scheduled_date >= ?
              AND status = 'pending' AND source = 'rule_generated'
              AND is_overridden = 0 AND generation_revision = ?
            ORDER BY scheduled_date, id
            """,
            (task.id, today.isoformat(), task.rule_revision),
        ).fetchall()
        return tuple(str(row["id"]) for row in rows)

    @staticmethod
    def _require_task_write(
        connection: sqlite3.Connection, task_id: str, rowcount: int
    ) -> None:
        if rowcount:
            return
        row = connection.execute(
            "SELECT version FROM tasks WHERE id = ?", (task_id,)
        ).fetchone()
        code = "target_missing" if row is None else "version_conflict"
        raise MutationError(code, target_id=task_id)
