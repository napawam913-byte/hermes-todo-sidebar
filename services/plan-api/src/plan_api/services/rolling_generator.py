"""模块用途：为有效滚动任务幂等补齐从今天起的七天条目窗口。"""

from collections.abc import Callable
from datetime import date, datetime, timedelta, timezone
import sqlite3
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field

from ..contracts.content import serialize_validated_content
from ..contracts.schedule_rules import (
    Cadence,
    ScheduleRuleV1,
    ScheduleSlotV1,
    validate_schedule_rule_payload,
)
from ..contracts.tasks import TaskView, format_utc
from ..db.database import Database
from ..repositories.task_repository import TaskRepository


class RollingResult(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    createdEntryIds: tuple[str, ...] = ()
    serverRevision: int = Field(ge=0)


class RollingGenerator:
    def __init__(
        self,
        database: Database,
        repository: TaskRepository,
        *,
        clock: Callable[[], datetime] | None = None,
        id_factory: Callable[[], str] | None = None,
    ) -> None:
        self._database = database
        self._repository = repository
        self._clock = clock or (lambda: datetime.now(timezone.utc))
        self._id_factory = id_factory or (lambda: uuid4().hex)

    def ensure_window(self, today: date) -> RollingResult:
        created: list[str] = []
        metadata_changed = False
        with self._database.transaction() as connection:
            for task in self._list_eligible(connection):
                task_created, task_metadata_changed = self._generate_task_window(
                    connection, task, task.schedule_rule, today
                )
                created.extend(task_created)
                metadata_changed |= task_metadata_changed
            revision = self._revision(
                connection, changed=bool(created) or metadata_changed
            )
        return RollingResult(
            createdEntryIds=tuple(created),
            serverRevision=revision,
        )

    def ensure_task_window(
        self,
        connection: sqlite3.Connection,
        task: TaskView,
        rule: ScheduleRuleV1 | None,
        today: date,
    ) -> tuple[str, ...]:
        created, _ = self._generate_task_window(
            connection, task, rule, today
        )
        return created

    def _generate_task_window(
        self,
        connection: sqlite3.Connection,
        task: TaskView,
        rule: ScheduleRuleV1 | None,
        today: date,
    ) -> tuple[tuple[str, ...], bool]:
        validated = validate_schedule_rule_payload(rule)
        if validated is None:
            return (), False
        end = today + timedelta(days=6)
        created: list[str] = []
        for offset in range(7):
            candidate = today + timedelta(days=offset)
            for slot in validated.slots:
                if matches(slot.cadence, candidate):
                    entry_id = self._insert_if_absent(
                        connection, task, slot, candidate
                    )
                    if entry_id is not None:
                        created.append(entry_id)
        metadata_changed = self._mark_generated_through(
            connection, task, end
        )
        return tuple(created), metadata_changed

    def _list_eligible(
        self, connection: sqlite3.Connection
    ) -> tuple[TaskView, ...]:
        rows = connection.execute(
            """
            SELECT id FROM tasks
            WHERE kind = 'cycle'
              AND status = 'active'
              AND generation_mode = 'rolling'
              AND schedule_rule_json IS NOT NULL
            ORDER BY created_at, id
            """
        ).fetchall()
        tasks = tuple(
            self._repository.get_task(connection, str(row["id"]))
            for row in rows
        )
        return tuple(task for task in tasks if task is not None)

    def _insert_if_absent(
        self,
        connection: sqlite3.Connection,
        task: TaskView,
        slot: ScheduleSlotV1,
        candidate: date,
    ) -> str | None:
        entry_id = self._id_factory()
        now = format_utc(self._clock())
        cursor = connection.execute(
            """
            INSERT OR IGNORE INTO task_entries (
                id, task_id, scheduled_date, status, content_json, source,
                slot_key, is_overridden, generation_revision, version,
                created_at, updated_at, completed_at
            ) VALUES (?, ?, ?, 'pending', ?, 'rule_generated',
                      ?, 0, ?, 1, ?, ?, NULL)
            """,
            (
                entry_id,
                task.id,
                candidate.isoformat(),
                serialize_validated_content(slot.content),
                slot.slotKey,
                task.rule_revision,
                now,
                now,
            ),
        )
        return entry_id if cursor.rowcount else None

    def _mark_generated_through(
        self,
        connection: sqlite3.Connection,
        task: TaskView,
        end: date,
    ) -> bool:
        cursor = connection.execute(
            """
            UPDATE tasks
            SET generated_through_date = ?, updated_at = ?
            WHERE id = ? AND rule_revision = ?
              AND (
                generated_through_date IS NULL
                OR generated_through_date < ?
              )
            """,
            (
                end.isoformat(),
                format_utc(self._clock()),
                task.id,
                task.rule_revision,
                end.isoformat(),
            ),
        )
        return bool(cursor.rowcount)

    def _revision(
        self, connection: sqlite3.Connection, *, changed: bool
    ) -> int:
        if changed:
            connection.execute(
                """
                UPDATE app_meta
                SET server_revision = server_revision + 1, updated_at = ?
                WHERE id = 1
                """,
                (format_utc(self._clock()),),
            )
        row = connection.execute(
            "SELECT server_revision FROM app_meta WHERE id = 1"
        ).fetchone()
        return int(row["server_revision"])


def matches(cadence: Cadence, candidate: date) -> bool:
    if cadence.type == "daily":
        return True
    return candidate.isoweekday() in cadence.weekdays
