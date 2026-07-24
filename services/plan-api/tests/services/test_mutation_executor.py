import pytest
from pydantic import ValidationError

from plan_api.contracts.mutations import MutationError

from mutation_helpers import (
    batch,
    content,
    create_cycle,
    entry_draft,
    operation,
    rows,
    setup_executor,
    task_draft,
)


def test_task_operation_matrix(tmp_path) -> None:
    database, executor = setup_executor(tmp_path)
    task_id, entry_id = create_cycle(executor)

    updated = executor.execute(
        batch(
            "task-update",
            operation(
                "task.update",
                targetId=task_id,
                expectedVersion=1,
                patch={"content": content("Updated")},
            ),
            operation(
                "task.setStatus",
                targetId=task_id,
                expectedVersion=2,
                status="paused",
            ),
        ),
        actor="desktop",
    )
    assert updated.changedTaskIds == (task_id,)
    assert updated.changedEntryIds == ()
    assert updated.serverRevision == 2
    task = rows(database, "tasks")[0]
    assert '"title":"Updated"' in task["content_json"]
    assert task["status"] == "paused"
    assert task["version"] == 3

    deleted = executor.execute(
        batch(
            "task-delete",
            operation(
                "task.delete",
                targetId=task_id,
                expectedVersion=3,
            ),
        ),
        actor="desktop",
    )
    assert deleted.changedTaskIds == (task_id,)
    assert deleted.changedEntryIds == (entry_id,)
    assert rows(database, "tasks") == []
    assert rows(database, "task_entries") == []


def test_entry_operation_matrix(tmp_path) -> None:
    database, executor = setup_executor(tmp_path)
    task_id, first_entry = create_cycle(executor)

    created = executor.execute(
        batch(
            "entry-create",
            operation(
                "entry.create",
                taskId=task_id,
                draft={
                    **entry_draft("Second"),
                    "scheduled_date": "2026-07-25",
                },
            ),
        ),
        actor="desktop",
    )
    second_entry = next(
        item for item in created.changedEntryIds if item != first_entry
    )
    assert created.changedTaskIds == (task_id,)

    executor.execute(
        batch(
            "entry-lifecycle-one",
            operation(
                "entry.update",
                targetId=second_entry,
                expectedVersion=1,
                patch={
                    "scheduledDate": "2026-07-26",
                    "content": content("Changed entry"),
                },
            ),
            operation(
                "entry.complete",
                targetId=second_entry,
                expectedVersion=2,
            ),
            operation(
                "entry.reopen",
                targetId=second_entry,
                expectedVersion=3,
            ),
            operation(
                "entry.skip",
                targetId=second_entry,
                expectedVersion=4,
            ),
        ),
        actor="desktop",
    )
    entry = next(
        item for item in rows(database, "task_entries")
        if item["id"] == second_entry
    )
    assert entry["scheduled_date"] == "2026-07-26"
    assert entry["status"] == "skipped"
    assert entry["completed_at"] is None
    assert entry["version"] == 5

    executor.execute(
        batch(
            "entry-delete",
            operation(
                "entry.delete",
                targetId=second_entry,
                expectedVersion=5,
            ),
        ),
        actor="desktop",
    )
    assert [item["id"] for item in rows(database, "task_entries")] == [
        first_entry
    ]


@pytest.mark.parametrize("count", [0, 2])
def test_daily_create_requires_exactly_one_entry(tmp_path, count: int) -> None:
    _, executor = setup_executor(tmp_path)
    with pytest.raises(ValidationError, match="daily_requires_one_entry"):
        batch(
            f"daily-{count}",
            operation(
                "task.create",
                draft=task_draft(
                    kind="daily",
                    entries=[entry_draft() for _ in range(count)],
                ),
            ),
        )


def test_contract_rejects_unknown_operations_and_fields() -> None:
    with pytest.raises(ValidationError):
        batch("unknown", operation("task.rename", targetId="task"))
    with pytest.raises(ValidationError):
        batch(
            "extra",
            operation("task.delete", targetId="task", expectedVersion=1, nope=1),
        )


def test_task_patch_rejects_null_generation_mode() -> None:
    with pytest.raises(ValidationError):
        batch(
            "null-mode",
            operation(
                "task.update",
                targetId="task",
                expectedVersion=1,
                patch={"generationMode": None},
            ),
        )
