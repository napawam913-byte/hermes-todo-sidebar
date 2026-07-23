from dataclasses import dataclass
from datetime import date, datetime, timezone

import pytest
from pydantic import BaseModel

from plan_api.contracts.tasks import GenerationMode, TaskDraft, TaskEntryDraft, TaskKind
from plan_api.db.database import Database
from plan_api.db.migrations import apply_migrations
from plan_api.repositories.task_repository import TaskRepository


NOW = datetime(2026, 7, 23, 1, 2, 3, tzinfo=timezone.utc)


@dataclass
class _DataclassValue:
    value: int


class _ModelValue(BaseModel):
    value: int


class _CustomList(list):
    pass


class _CustomDict(dict):
    pass


def test_insert_revalidates_mutated_entry_array_before_writing(tmp_path) -> None:
    database = _database(tmp_path)
    repository = _repository("task-mutated", "entry-mutated")
    draft = _daily_draft(list(range(200)))
    draft.entries[0].content.sections[0].fields[0].value.append(200)

    _assert_rejected_without_writes(
        database, repository, draft, "array_too_large"
    )


@pytest.mark.parametrize("target", ["task", "entry"])
def test_insert_rejects_datetime_before_writing(tmp_path, target: str) -> None:
    database = _database(tmp_path)
    repository = _repository("task-datetime", "entry-datetime")
    draft = _daily_draft("safe")
    _target_content(draft, target).sections[0].fields[0].value = NOW

    _assert_rejected_without_writes(database, repository, draft, "content_not_json")


@pytest.mark.parametrize("target", ["task", "entry"])
@pytest.mark.parametrize(
    "value",
    [
        _DataclassValue(1),
        _ModelValue(value=1),
        _CustomList([1]),
        _CustomDict({"a": 1}),
    ],
)
def test_insert_rejects_custom_object_before_writing(
    tmp_path, target: str, value
) -> None:
    database = _database(tmp_path)
    repository = _repository("task-custom", "entry-custom")
    draft = _daily_draft("safe")
    _target_content(draft, target).sections[0].fields[0].value = value

    _assert_rejected_without_writes(database, repository, draft, "content_not_json")


@pytest.mark.parametrize(
    "value",
    [
        _DataclassValue(1),
        _ModelValue(value=1),
        _CustomList([1]),
        _CustomDict({"a": 1}),
    ],
)
def test_insert_rejects_custom_object_in_rule_slot_without_writes(
    tmp_path, value
) -> None:
    database = _database(tmp_path)
    repository = _repository("task-rule", "entry-rule")
    draft = TaskDraft(
        kind=TaskKind.CYCLE,
        generation_mode=GenerationMode.ROLLING,
        content=_content_payload("Task", "safe"),
        schedule_rule=_schedule_rule(),
    )
    draft.schedule_rule.slots[0].content.sections[0].fields[0].value = value

    _assert_rejected_without_writes(
        database, repository, draft, "invalid_schedule_rule"
    )


def _assert_rejected_without_writes(
    database: Database,
    repository: TaskRepository,
    draft: TaskDraft,
    error: str,
) -> None:
    with database.transaction() as connection:
        with pytest.raises(ValueError, match=f"^{error}$"):
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


def _daily_draft(value: object) -> TaskDraft:
    return TaskDraft(
        kind=TaskKind.DAILY,
        generation_mode=GenerationMode.FIXED,
        content=_content_payload("Task", value),
        entries=[TaskEntryDraft(
            scheduled_date=date(2026, 7, 23),
            content=_content_payload("Entry", value),
        )],
    )


def _target_content(draft: TaskDraft, target: str):
    return draft.content if target == "task" else draft.entries[0].content


def _content_payload(title: str, value: object) -> dict[str, object]:
    return {
        "schemaVersion": 1,
        "kind": "test.task",
        "title": title,
        "summary": "Fixed test content.",
        "locale": "en-US",
        "sections": [{
            "id": "main",
            "label": "Main",
            "layout": "fields",
            "fields": [{
                "key": "detail",
                "label": "Detail",
                "type": "value",
                "value": value,
            }],
        }],
    }


def _schedule_rule() -> dict[str, object]:
    return {
        "schemaVersion": 1,
        "timezone": "Asia/Shanghai",
        "horizonDays": 7,
        "slots": [{
            "slotKey": "strength",
            "cadence": {"type": "weekly", "weekdays": [1, 3, 5]},
            "content": _content_payload("Strength", "safe"),
        }],
    }
