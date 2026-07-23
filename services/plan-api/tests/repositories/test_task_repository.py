from datetime import date, datetime, timezone

import pytest
from pydantic import ValidationError

from plan_api.contracts.content import ContentDocument
from plan_api.contracts.tasks import (
    EntrySource,
    EntryStatus,
    GenerationMode,
    TaskDraft,
    TaskEntryDraft,
    TaskKind,
    TaskStatus,
)
from plan_api.db.database import Database
from plan_api.db.migrations import apply_migrations
from plan_api.repositories.task_repository import TaskRepository


NOW = datetime(2026, 7, 23, 1, 2, 3, tzinfo=timezone.utc)


def test_daily_round_trip_has_exactly_one_typed_entry(tmp_path) -> None:
    database = _database(tmp_path)
    repository = _repository("task-daily", "entry-daily")

    with database.transaction() as connection:
        task_id = repository.insert_task(
            connection,
            _draft(TaskKind.DAILY, [_entry("2026-07-23")]),
        )
    with database.connect() as connection:
        task = repository.get_task(connection, task_id)
        missing = repository.get_task(connection, "missing")

    assert task is not None
    assert task.kind is TaskKind.DAILY
    assert task.status is TaskStatus.ACTIVE
    assert task.generation_mode is GenerationMode.FIXED
    assert task.content.title == "Task"
    assert len(task.entries) == 1
    assert task.entries[0].status is EntryStatus.PENDING
    assert task.entries[0].source is EntrySource.MANUAL
    assert missing is None


@pytest.mark.parametrize("entry_count", [0, 2])
def test_daily_draft_requires_exactly_one_entry(entry_count: int) -> None:
    with pytest.raises(ValidationError, match="daily_requires_one_entry"):
        _draft(
            TaskKind.DAILY,
            [_entry("2026-07-23") for _ in range(entry_count)],
        )


def test_cycle_keeps_multiple_slots_on_the_same_date(tmp_path) -> None:
    database = _database(tmp_path)
    repository = _repository("task-cycle", "entry-am", "entry-pm")
    entries = [
        _entry("2026-07-24", slot_key="strength"),
        _entry("2026-07-24", slot_key="mobility"),
    ]

    with database.transaction() as connection:
        task_id = repository.insert_task(
            connection,
            _draft(TaskKind.CYCLE, entries, mode=GenerationMode.ROLLING),
        )
    with database.connect() as connection:
        task = repository.get_task(connection, task_id)

    assert task is not None
    assert [entry.slot_key for entry in task.entries] == [
        "strength",
        "mobility",
    ]


@pytest.mark.parametrize(
    ("table", "column", "value", "error"),
    [
        ("tasks", "content_json", "{}", "invalid_content"),
        ("tasks", "schedule_rule_json", "[]", "invalid_schedule_rule"),
        ("task_entries", "content_json", "{}", "invalid_content"),
    ],
)
def test_get_task_validates_every_json_column(
    tmp_path, table: str, column: str, value: str, error: str
) -> None:
    database = _database(tmp_path)
    repository = _repository("task-cycle", "entry-cycle")
    draft = _draft(
        TaskKind.CYCLE,
        [_entry("2026-07-24", slot_key="strength")],
        mode=GenerationMode.ROLLING,
        schedule_rule={"schemaVersion": 1},
    )
    with database.transaction() as connection:
        task_id = repository.insert_task(connection, draft)
        identifier = task_id if table == "tasks" else "entry-cycle"
        connection.execute(
            f"UPDATE {table} SET {column} = ? WHERE id = ?",
            (value, identifier),
        )

    with database.connect() as connection:
        with pytest.raises(ValueError, match=f"^{error}$"):
            repository.get_task(connection, task_id)


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("kind", "weekly"),
        ("status", "deleted"),
        ("generation_mode", "dynamic"),
    ],
)
def test_task_draft_rejects_unknown_enums(field: str, value: str) -> None:
    payload = _draft(TaskKind.CYCLE, []).model_dump()
    payload[field] = value

    with pytest.raises(ValidationError):
        TaskDraft.model_validate(payload)


def test_entry_draft_rejects_unknown_status_and_source() -> None:
    payload = _entry("2026-07-23").model_dump()

    for field, value in [("status", "open"), ("source", "system")]:
        invalid = {**payload, field: value}
        with pytest.raises(ValidationError):
            TaskEntryDraft.model_validate(invalid)


def _database(tmp_path) -> Database:
    database = Database(tmp_path / "plan.db")
    apply_migrations(database)
    return database


def _repository(*ids: str) -> TaskRepository:
    generated_ids = iter(ids)
    return TaskRepository(clock=lambda: NOW, id_factory=generated_ids.__next__)


def _draft(
    kind: TaskKind,
    entries: list[TaskEntryDraft],
    *,
    mode: GenerationMode = GenerationMode.FIXED,
    schedule_rule: dict[str, object] | None = None,
) -> TaskDraft:
    return TaskDraft(
        kind=kind,
        status=TaskStatus.ACTIVE,
        generation_mode=mode,
        content=_content("Task"),
        schedule_rule=schedule_rule,
        entries=entries,
    )


def _entry(day: str, *, slot_key: str | None = None) -> TaskEntryDraft:
    return TaskEntryDraft(
        scheduled_date=date.fromisoformat(day),
        status=EntryStatus.PENDING,
        content=_content(slot_key or "Daily entry"),
        source=(EntrySource.RULE_GENERATED if slot_key else EntrySource.MANUAL),
        slot_key=slot_key,
        generation_revision=1 if slot_key else None,
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
