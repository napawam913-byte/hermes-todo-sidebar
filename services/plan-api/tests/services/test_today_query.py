from datetime import date, datetime, timezone

from plan_api.contracts.content import ContentDocument
from plan_api.contracts.tasks import (
    EntryStatus,
    TaskDraft,
    TaskEntryDraft,
    TaskKind,
    TaskStatus,
)
from plan_api.db.database import Database
from plan_api.db.migrations import apply_migrations
from plan_api.repositories.task_repository import TaskRepository
from plan_api.services.query_service import QueryService


TARGET = date(2026, 7, 23)


def test_today_filters_active_tasks_and_uses_shanghai_day_boundaries(
    tmp_path,
) -> None:
    database = Database(tmp_path / "plan.db")
    apply_migrations(database)
    _add(database, "overdue-old", "2026-07-20", created="2026-07-20T10:00:00Z")
    _add(database, "overdue-new", "2026-07-22", created="2026-07-22T10:00:00Z")
    _add(
        database,
        "completed-start",
        "2026-07-21",
        status=EntryStatus.COMPLETED,
        completed="2026-07-22T16:00:00Z",
        created="2026-07-21T10:00:00Z",
    )
    _add(database, "today-late", "2026-07-23", created="2026-07-23T10:00:00Z")
    _add(database, "today-early", "2026-07-23", created="2026-07-23T09:00:00Z")
    _add(
        database,
        "today-skipped",
        "2026-07-23",
        status=EntryStatus.SKIPPED,
        created="2026-07-23T09:30:00Z",
    )
    _add(
        database,
        "today-completed-outside-window",
        "2026-07-23",
        status=EntryStatus.COMPLETED,
        completed="2026-07-22T15:59:59Z",
        created="2026-07-23T09:45:00Z",
    )
    _add(
        database,
        "completed-end-minus",
        "2026-07-24",
        status=EntryStatus.COMPLETED,
        completed="2026-07-23T15:59:59Z",
        created="2026-07-23T08:00:00Z",
    )
    _add(
        database,
        "before-start",
        "2026-07-19",
        status=EntryStatus.COMPLETED,
        completed="2026-07-22T15:59:59Z",
        created="2026-07-19T08:00:00Z",
    )
    _add(
        database,
        "at-end",
        "2026-07-19",
        status=EntryStatus.COMPLETED,
        completed="2026-07-23T16:00:00Z",
        created="2026-07-19T09:00:00Z",
    )
    _add(
        database,
        "paused",
        "2026-07-23",
        task_status=TaskStatus.PAUSED,
        kind=TaskKind.CYCLE,
        created="2026-07-23T07:00:00Z",
    )

    view = QueryService(database).today(TARGET)

    assert view.target_date == TARGET
    assert [item.entry.id for item in view.items] == [
        "entry-overdue-old",
        "entry-overdue-new",
        "entry-completed-start",
        "entry-today-early",
        "entry-today-skipped",
        "entry-today-completed-outside-window",
        "entry-today-late",
        "entry-completed-end-minus",
    ]
    assert [item.is_overdue for item in view.items] == [
        True,
        True,
        False,
        False,
        False,
        False,
        False,
        False,
    ]
    assert all(item.task_status is TaskStatus.ACTIVE for item in view.items)


def _add(
    database: Database,
    name: str,
    scheduled: str,
    *,
    status: EntryStatus = EntryStatus.PENDING,
    completed: str | None = None,
    created: str,
    task_status: TaskStatus = TaskStatus.ACTIVE,
    kind: TaskKind = TaskKind.DAILY,
) -> None:
    created_at = _utc(created)
    ids = iter([f"task-{name}", f"entry-{name}"])
    repository = TaskRepository(
        clock=lambda: created_at,
        id_factory=ids.__next__,
    )
    draft = TaskDraft(
        kind=kind,
        status=task_status,
        generation_mode="fixed",
        content=_content(f"Task {name}"),
        entries=[
            TaskEntryDraft(
                scheduled_date=date.fromisoformat(scheduled),
                status=status,
                content=_content(f"Entry {name}"),
                source="manual",
                completed_at=_utc(completed) if completed else None,
            )
        ],
    )
    with database.transaction() as connection:
        repository.insert_task(connection, draft)


def _utc(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(
        timezone.utc
    )


def _content(title: str) -> ContentDocument:
    return ContentDocument.model_validate(
        {
            "schemaVersion": 1,
            "kind": "test.task",
            "title": title,
            "summary": "Fixed test content.",
            "locale": "en-US",
            "sections": [],
        }
    )
