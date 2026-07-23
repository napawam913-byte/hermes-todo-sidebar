from dataclasses import dataclass
from datetime import datetime, timezone

import pytest
from pydantic import BaseModel

from plan_api.contracts.tasks import GenerationMode, TaskDraft, TaskKind
from plan_api.db.database import Database
from plan_api.db.migrations import apply_migrations
from plan_api.repositories.task_repository import TaskRepository


NOW = datetime(2026, 7, 23, 1, 2, 3, tzinfo=timezone.utc)


class _CustomList(list):
    pass


@dataclass
class _DataclassSlot:
    slotKey: str
    cadence: object
    content: object


class _ModelSlot(BaseModel):
    slotKey: str
    cadence: object
    content: object


@pytest.mark.parametrize("field", ["slots", "weekdays", "sections"])
def test_insert_rejects_mutated_rule_structure_without_writes(
    tmp_path, field: str
) -> None:
    database = _database(tmp_path)
    draft = _cycle_draft()
    slot = draft.schedule_rule.slots[0]
    if field == "slots":
        object.__setattr__(draft.schedule_rule, "slots", _CustomList([slot]))
    elif field == "weekdays":
        object.__setattr__(slot.cadence, "weekdays", _CustomList([1, 3, 5]))
    else:
        slot.content.sections = _CustomList(slot.content.sections)

    _assert_rejected_without_writes(database, draft)


@pytest.mark.parametrize("slot_type", [_DataclassSlot, _ModelSlot])
def test_insert_rejects_mutated_rule_slot_object_without_writes(
    tmp_path, slot_type
) -> None:
    database = _database(tmp_path)
    draft = _cycle_draft()
    slot = draft.schedule_rule.slots[0]
    object.__setattr__(
        draft.schedule_rule,
        "slots",
        (slot_type(slotKey=slot.slotKey, cadence=slot.cadence, content=slot.content),),
    )

    _assert_rejected_without_writes(database, draft)


def _assert_rejected_without_writes(database: Database, draft: TaskDraft) -> None:
    with database.transaction() as connection:
        with pytest.raises(ValueError, match="^invalid_schedule_rule$"):
            _repository().insert_task(connection, draft)
        assert connection.execute("SELECT COUNT(*) FROM tasks").fetchone()[0] == 0
        assert connection.execute("SELECT COUNT(*) FROM task_entries").fetchone()[0] == 0


def _database(tmp_path) -> Database:
    database = Database(tmp_path / "plan.db")
    apply_migrations(database)
    return database


def _repository() -> TaskRepository:
    ids = iter(["task-rule"])
    return TaskRepository(clock=lambda: NOW, id_factory=ids.__next__)


def _cycle_draft() -> TaskDraft:
    return TaskDraft(
        kind=TaskKind.CYCLE,
        generation_mode=GenerationMode.ROLLING,
        content=_content_payload("Task"),
        schedule_rule={
            "schemaVersion": 1,
            "timezone": "Asia/Shanghai",
            "horizonDays": 7,
            "slots": [{
                "slotKey": "strength",
                "cadence": {"type": "weekly", "weekdays": [1, 3, 5]},
                "content": _content_payload("Strength"),
            }],
        },
    )


def _content_payload(title: str) -> dict[str, object]:
    return {
        "schemaVersion": 1,
        "kind": "test.task",
        "title": title,
        "summary": "Fixed test content.",
        "locale": "en-US",
        "sections": [],
    }
