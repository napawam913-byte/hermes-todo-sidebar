from datetime import date
import sqlite3

import pytest

from plan_api.contracts.mutations import MutationError
from plan_api.db.database import Database
from plan_api.db.migrations import apply_migrations
from plan_api.services.mutation_executor import MutationExecutor

from mutation_helpers import (
    NOW,
    batch,
    content,
    create_cycle,
    entry_draft,
    operation,
    rows,
    setup_executor,
)


@pytest.mark.parametrize(
    "kind",
    [
        "task.update",
        "task.setStatus",
        "task.delete",
        "entry.update",
        "entry.complete",
        "entry.reopen",
        "entry.skip",
        "entry.delete",
    ],
)
def test_every_update_and_delete_rejects_stale_versions(
    tmp_path, kind: str
) -> None:
    _, executor = setup_executor(tmp_path)
    task_id, entry_id = create_cycle(executor)
    target_id = task_id if kind.startswith("task.") else entry_id
    values: dict[str, object] = {
        "targetId": target_id,
        "expectedVersion": 99,
    }
    if kind == "task.update":
        values["patch"] = {"content": content("Nope")}
    if kind == "task.setStatus":
        values["status"] = "paused"
    if kind == "entry.update":
        values["patch"] = {"scheduledDate": "2026-07-25"}

    with pytest.raises(MutationError) as captured:
        executor.execute(
            batch(f"stale-{kind}", operation(kind, **values)),
            actor="desktop",
        )

    assert captured.value.code == "version_conflict"


def test_hermes_actor_cannot_execute_direct_mutations(tmp_path) -> None:
    database, executor = setup_executor(tmp_path)
    with pytest.raises(MutationError) as captured:
        executor.execute(
            batch(
                "forbidden",
                operation("task.create", draft={
                    "kind": "cycle",
                    "generation_mode": "fixed",
                    "content": content("Forbidden"),
                    "entries": [],
                }),
            ),
            actor="hermes",
        )

    assert captured.value.code == "permission_denied"
    assert rows(database, "tasks") == []


def test_daily_entry_cardinality_cannot_be_bypassed(tmp_path) -> None:
    _, executor = setup_executor(tmp_path)
    created = executor.execute(
        batch(
            "daily",
            operation("task.create", draft={
                "kind": "daily",
                "generation_mode": "fixed",
                "content": content("Daily"),
                "entries": [entry_draft()],
            }),
        ),
        actor="desktop",
    )
    task_id = created.changedTaskIds[0]
    entry_id = created.changedEntryIds[0]

    for key, change in [
        ("add", operation("entry.create", taskId=task_id, draft=entry_draft())),
        (
            "remove",
            operation(
                "entry.delete",
                targetId=entry_id,
                expectedVersion=1,
            ),
        ),
    ]:
        with pytest.raises(MutationError) as captured:
            executor.execute(batch(key, change), actor="desktop")
        assert captured.value.code == "validation_failed"


def test_unexpected_database_error_becomes_persistence_failure(
    tmp_path, monkeypatch
) -> None:
    _, executor = setup_executor(tmp_path)

    def fail(*_args, **_kwargs):
        raise sqlite3.OperationalError("disk I/O error")

    monkeypatch.setattr(executor._tasks, "create", fail)
    with pytest.raises(MutationError) as captured:
        executor.execute(
            batch("failure", operation("task.create", draft={
                "kind": "cycle",
                "generation_mode": "fixed",
                "content": content("Failure"),
                "entries": [],
            })),
            actor="desktop",
        )

    assert captured.value.code == "persistence_failed"


def test_duplicate_generated_slot_is_validation_failure(tmp_path) -> None:
    _, executor = setup_executor(tmp_path)
    duplicate = {
        **entry_draft(),
        "source": "rule_generated",
        "slot_key": "strength",
        "generation_revision": 1,
    }
    with pytest.raises(MutationError) as captured:
        executor.execute(
            batch(
                "duplicate-slot",
                operation("task.create", draft={
                    "kind": "cycle",
                    "generation_mode": "fixed",
                    "content": content("Duplicate"),
                    "entries": [duplicate, duplicate],
                }),
            ),
            actor="desktop",
        )

    assert captured.value.code == "validation_failed"


def test_unexpected_audit_integrity_error_is_persistence_failure(
    tmp_path,
) -> None:
    database = Database(tmp_path / "plan.db")
    apply_migrations(database)
    generated = iter(["task-1", "audit", "task-2", "audit"])
    executor = MutationExecutor(
        database,
        clock=lambda: NOW,
        id_factory=generated.__next__,
    )
    executor.execute(
        batch("first", operation("task.create", draft={
            "kind": "cycle",
            "generation_mode": "fixed",
            "content": content("First"),
            "entries": [],
        })),
        actor="desktop",
    )

    with pytest.raises(MutationError) as captured:
        executor.execute(
            batch("second", operation("task.create", draft={
                "kind": "cycle",
                "generation_mode": "fixed",
                "content": content("Second"),
                "entries": [],
            })),
            actor="desktop",
        )

    assert captured.value.code == "persistence_failed"
    assert [row["id"] for row in rows(database, "tasks")] == ["task-1"]
