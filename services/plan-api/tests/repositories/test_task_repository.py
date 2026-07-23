from datetime import date, datetime, timezone

import pytest
from pydantic import ValidationError

from plan_api.contracts.content import ContentDocument, ContentSection
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
            _draft(
                TaskKind.CYCLE,
                entries,
                mode=GenerationMode.ROLLING,
                schedule_rule=_schedule_rule(),
            ),
        )
    with database.connect() as connection:
        task = repository.get_task(connection, task_id)

    assert task is not None
    assert [entry.slot_key for entry in task.entries] == [
        "strength",
        "mobility",
    ]
    assert task.schedule_rule is not None
    assert task.schedule_rule.slots[0].cadence.type == "weekly"


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
        schedule_rule=_schedule_rule(),
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


@pytest.mark.parametrize("draft_type", [TaskDraft, TaskEntryDraft])
@pytest.mark.parametrize("as_document", [False, True])
def test_drafts_recheck_content_array_bound(
    draft_type, as_document: bool
) -> None:
    payload = _content_payload("Too many items", list(range(201)))
    content = ContentDocument.model_validate(payload) if as_document else payload

    with pytest.raises(ValidationError, match="array_too_large"):
        draft_type.model_validate(_draft_payload(draft_type, content))


@pytest.mark.parametrize(
    ("draft_type", "value", "as_document", "error"),
    [
        (
            TaskDraft,
            {"nested": {"nested": {"nested": {}}}},
            True,
            "content_too_deep",
        ),
        (
            TaskEntryDraft,
            "x" * 65536,
            False,
            "content_too_large",
        ),
    ],
    ids=["too-deep-model", "too-large-dict"],
)
def test_drafts_recheck_content_depth_and_size_bounds(
    draft_type, value: object, as_document: bool, error: str
) -> None:
    payload = _content_payload("Invalid content", value)
    content = ContentDocument.model_validate(payload) if as_document else payload

    with pytest.raises(ValidationError, match=error):
        draft_type.model_validate(_draft_payload(draft_type, content))


def test_valid_dict_content_writes_and_round_trips(tmp_path) -> None:
    database = _database(tmp_path)
    repository = _repository("task-dict", "entry-dict")
    draft = TaskDraft.model_validate(
        {
            "kind": "daily",
            "generation_mode": "fixed",
            "content": _content_payload("Dictionary task"),
            "entries": [
                {
                    "scheduled_date": "2026-07-23",
                    "content": _content_payload("Dictionary entry"),
                }
            ],
        }
    )

    with database.transaction() as connection:
        task_id = repository.insert_task(connection, draft)
    with database.connect() as connection:
        task = repository.get_task(connection, task_id)

    assert task is not None
    assert task.content.title == "Dictionary task"
    assert task.entries[0].content.title == "Dictionary entry"


def test_insert_revalidates_mutated_entry_content_before_writing(tmp_path) -> None:
    database = _database(tmp_path)
    repository = _repository("task-mutated", "entry-mutated")
    entry = TaskEntryDraft(
        scheduled_date=date(2026, 7, 23),
        content=_content_payload("Mutable entry", list(range(200))),
    )
    draft = _draft(TaskKind.DAILY, [entry])
    draft.entries[0].content.sections[0].fields[0].value.append(200)

    with database.transaction() as connection:
        with pytest.raises(ValueError, match="^array_too_large$"):
            repository.insert_task(connection, draft)
        assert connection.execute("SELECT COUNT(*) FROM tasks").fetchone()[0] == 0
        assert connection.execute("SELECT COUNT(*) FROM task_entries").fetchone()[0] == 0


@pytest.mark.parametrize("draft_type", [TaskDraft, TaskEntryDraft])
def test_drafts_reject_pre_mutated_document_without_writing(
    tmp_path, draft_type
) -> None:
    database = _database(tmp_path)
    content = _content("Pre-mutated document")
    content.sections.append(
        ContentSection.model_validate(
            _content_payload("Mutable section", "safe")["sections"][0]
        )
    )
    content.sections[-1].fields[0].value = NOW

    with database.transaction() as connection:
        with pytest.raises(ValidationError, match="content_not_json"):
            if draft_type is TaskDraft:
                TaskDraft(
                    kind=TaskKind.DAILY,
                    generation_mode=GenerationMode.FIXED,
                    content=content,
                    entries=[_entry("2026-07-23")],
                )
            else:
                TaskEntryDraft(
                    scheduled_date=date(2026, 7, 23), content=content
                )
        assert connection.execute("SELECT COUNT(*) FROM tasks").fetchone()[0] == 0
        assert connection.execute("SELECT COUNT(*) FROM task_entries").fetchone()[0] == 0


@pytest.mark.parametrize("target", ["task", "entry"])
def test_insert_rejects_datetime_in_mutated_content_before_writing(
    tmp_path, target: str
) -> None:
    database = _database(tmp_path)
    repository = _repository("task-mutated-datetime", "entry-mutated-datetime")
    draft = TaskDraft(
        kind=TaskKind.DAILY,
        generation_mode=GenerationMode.FIXED,
        content=_content_payload("Mutable task", "safe"),
        entries=[
            TaskEntryDraft(
                scheduled_date=date(2026, 7, 23),
                content=_content_payload("Mutable entry", "safe"),
            )
        ],
    )
    content = draft.content if target == "task" else draft.entries[0].content
    content.sections[0].fields[0].value = NOW

    with database.transaction() as connection:
        with pytest.raises(ValueError, match="^content_not_json$"):
            repository.insert_task(connection, draft)
        assert connection.execute("SELECT COUNT(*) FROM tasks").fetchone()[0] == 0
        assert connection.execute("SELECT COUNT(*) FROM task_entries").fetchone()[0] == 0


def test_insert_revalidates_mutated_schedule_rule_before_writing(tmp_path) -> None:
    database = _database(tmp_path)
    repository = _repository("task-mutated-rule", "entry-mutated-rule")
    draft = _draft(
        TaskKind.CYCLE,
        [_entry("2026-07-23", slot_key="strength")],
        mode=GenerationMode.ROLLING,
        schedule_rule=_schedule_rule(),
    )
    draft.schedule_rule.slots[0].content.sections.append(
        ContentSection.model_validate(
            _content_payload("Schedule content", list(range(200)))["sections"][0]
        )
    )
    draft.schedule_rule.slots[0].content.sections[0].fields[0].value = NOW

    with database.transaction() as connection:
        with pytest.raises(ValueError, match="^invalid_schedule_rule$"):
            repository.insert_task(connection, draft)
        assert connection.execute("SELECT COUNT(*) FROM tasks").fetchone()[0] == 0
        assert connection.execute("SELECT COUNT(*) FROM task_entries").fetchone()[0] == 0


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
    schedule_rule: object | None = None,
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
    return ContentDocument.model_validate(_content_payload(title))


def _content_payload(
    title: str, value: object | None = None
) -> dict[str, object]:
    sections: list[object] = []
    if value is not None:
        sections.append(
            {
                "id": "main",
                "label": "Main",
                "layout": "fields",
                "fields": [
                    {
                        "key": "detail",
                        "label": "Detail",
                        "type": "value",
                        "value": value,
                    }
                ],
            }
        )
    return {
        "schemaVersion": 1,
        "kind": "test.task",
        "title": title,
        "summary": "Fixed test content.",
        "locale": "en-US",
        "sections": sections,
    }


def _schedule_rule() -> dict[str, object]:
    return {
        "schemaVersion": 1,
        "timezone": "Asia/Shanghai",
        "horizonDays": 7,
        "slots": [
            {
                "slotKey": "strength",
                "cadence": {"type": "weekly", "weekdays": [1, 3, 5]},
                "content": _content_payload("Strength"),
            }
        ],
    }


def _draft_payload(draft_type, content: object) -> dict[str, object]:
    if draft_type is TaskDraft:
        return {
            "kind": "cycle",
            "generation_mode": "fixed",
            "content": content,
        }
    return {"scheduled_date": "2026-07-23", "content": content}
