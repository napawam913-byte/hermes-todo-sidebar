from collections.abc import Callable
from datetime import date, datetime, timezone
import sqlite3
from typing import Any
from uuid import uuid4

from ..contracts.tasks import (
    EntryStatus,
    TaskDraft,
    TaskEntryView,
    TaskKind,
    TaskStatus,
    TaskView,
    TodayItem,
    dump_json,
    format_utc,
    load_content_json,
    load_schedule_rule_json,
    parse_utc,
)


class TaskRepository:
    def __init__(
        self,
        *,
        clock: Callable[[], datetime] | None = None,
        id_factory: Callable[[], str] | None = None,
    ) -> None:
        self._clock = clock or (lambda: datetime.now(timezone.utc))
        self._id_factory = id_factory or (lambda: uuid4().hex)

    def insert_task(
        self, connection: sqlite3.Connection, draft: TaskDraft
    ) -> str:
        if draft.kind is TaskKind.DAILY and len(draft.entries) != 1:
            raise ValueError("daily_requires_one_entry")
        task_id = self._id_factory()
        now = format_utc(self._clock())
        connection.execute(
            """
            INSERT INTO tasks (
                id, kind, status, generation_mode, content_json,
                schedule_rule_json, generated_through_date, rule_revision,
                version, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
            """,
            (
                task_id,
                draft.kind.value,
                draft.status.value,
                draft.generation_mode.value,
                dump_json(draft.content.model_dump(mode="json")),
                (
                    dump_json(draft.schedule_rule)
                    if draft.schedule_rule is not None
                    else None
                ),
                (
                    draft.generated_through_date.isoformat()
                    if draft.generated_through_date
                    else None
                ),
                draft.rule_revision,
                now,
                now,
            ),
        )
        for entry in draft.entries:
            connection.execute(
                """
                INSERT INTO task_entries (
                    id, task_id, scheduled_date, status, content_json, source,
                    slot_key, is_overridden, generation_revision, version,
                    created_at, updated_at, completed_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
                """,
                (
                    self._id_factory(),
                    task_id,
                    entry.scheduled_date.isoformat(),
                    entry.status.value,
                    dump_json(entry.content.model_dump(mode="json")),
                    entry.source.value,
                    entry.slot_key,
                    int(entry.is_overridden),
                    entry.generation_revision,
                    now,
                    now,
                    format_utc(entry.completed_at) if entry.completed_at else None,
                ),
            )
        return task_id

    def get_task(
        self, connection: sqlite3.Connection, task_id: str
    ) -> TaskView | None:
        row = connection.execute(
            "SELECT * FROM tasks WHERE id = ?", (task_id,)
        ).fetchone()
        if row is None:
            return None
        entry_rows = connection.execute(
            """
            SELECT * FROM task_entries
            WHERE task_id = ?
            ORDER BY scheduled_date, created_at, id
            """,
            (task_id,),
        ).fetchall()
        entries = tuple(_entry_view(item) for item in entry_rows)
        return TaskView(
            id=str(row["id"]),
            kind=TaskKind(row["kind"]),
            status=TaskStatus(row["status"]),
            generation_mode=row["generation_mode"],
            content=load_content_json(row["content_json"]),
            schedule_rule=load_schedule_rule_json(row["schedule_rule_json"]),
            generated_through_date=_optional_date(row["generated_through_date"]),
            rule_revision=int(row["rule_revision"]),
            version=int(row["version"]),
            created_at=parse_utc(row["created_at"]),
            updated_at=parse_utc(row["updated_at"]),
            entries=entries,
        )

    def list_today(
        self,
        connection: sqlite3.Connection,
        target_date: date,
        completed_start: datetime,
        completed_end: datetime,
    ) -> tuple[TodayItem, ...]:
        day = target_date.isoformat()
        rows = connection.execute(
            """
            SELECT e.*, t.kind AS task_kind, t.status AS task_status,
                   t.content_json AS task_content_json
            FROM task_entries e
            JOIN tasks t ON t.id = e.task_id
            WHERE t.status = 'active'
              AND (
                e.scheduled_date = ?
                OR (e.scheduled_date < ? AND e.status = 'pending')
                OR (
                  e.status = 'completed'
                  AND e.completed_at >= ?
                  AND e.completed_at < ?
                )
              )
            ORDER BY
              CASE WHEN e.status = 'pending' AND e.scheduled_date < ?
                   THEN 0 ELSE 1 END,
              e.scheduled_date,
              e.created_at
            """,
            (
                day,
                day,
                format_utc(completed_start),
                format_utc(completed_end),
                day,
            ),
        ).fetchall()
        return tuple(_today_item(row, target_date) for row in rows)


def _entry_view(row: sqlite3.Row) -> TaskEntryView:
    return TaskEntryView(
        id=str(row["id"]),
        task_id=str(row["task_id"]),
        scheduled_date=date.fromisoformat(row["scheduled_date"]),
        status=EntryStatus(row["status"]),
        content=load_content_json(row["content_json"]),
        source=row["source"],
        slot_key=row["slot_key"],
        is_overridden=bool(row["is_overridden"]),
        generation_revision=_optional_int(row["generation_revision"]),
        version=int(row["version"]),
        created_at=parse_utc(row["created_at"]),
        updated_at=parse_utc(row["updated_at"]),
        completed_at=(
            parse_utc(row["completed_at"]) if row["completed_at"] else None
        ),
    )


def _today_item(row: sqlite3.Row, target_date: date) -> TodayItem:
    entry = _entry_view(row)
    return TodayItem(
        task_kind=TaskKind(row["task_kind"]),
        task_status=TaskStatus(row["task_status"]),
        task_content=load_content_json(row["task_content_json"]),
        entry=entry,
        is_overdue=(
            entry.status is EntryStatus.PENDING
            and entry.scheduled_date < target_date
        ),
    )


def _optional_date(value: Any) -> date | None:
    return date.fromisoformat(value) if value is not None else None


def _optional_int(value: Any) -> int | None:
    return int(value) if value is not None else None
