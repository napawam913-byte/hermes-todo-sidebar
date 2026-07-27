import pytest
from pydantic import ValidationError

from plan_api.contracts.mutations import MutationBatch, MutationError

from mutation_helpers import (
    batch,
    content,
    create_cycle,
    operation,
    rows,
    setup_executor,
)


def test_failing_second_operation_rolls_back_first(tmp_path) -> None:
    database, executor = setup_executor(tmp_path)
    task_id, _ = create_cycle(executor)

    with pytest.raises(MutationError) as captured:
        executor.execute(
            batch(
                "rollback",
                operation(
                    "task.update",
                    targetId=task_id,
                    expectedVersion=1,
                    patch={"content": content("Must roll back")},
                ),
                operation(
                    "entry.complete",
                    targetId="missing",
                    expectedVersion=1,
                ),
            ),
            actor="desktop",
        )

    assert captured.value.code == "target_missing"
    task = rows(database, "tasks")[0]
    assert '"title":"Task"' in task["content_json"]
    assert task["version"] == 1
    assert len(rows(database, "audit_events")) == 1
    assert len(rows(database, "idempotency_records")) == 1


def test_stale_version_is_distinct_from_missing_target(tmp_path) -> None:
    _, executor = setup_executor(tmp_path)
    task_id, _ = create_cycle(executor)

    with pytest.raises(MutationError) as stale:
        executor.execute(
            batch(
                "stale",
                operation(
                    "task.delete",
                    targetId=task_id,
                    expectedVersion=99,
                ),
            ),
            actor="desktop",
        )
    with pytest.raises(MutationError) as missing:
        executor.execute(
            batch(
                "missing",
                operation(
                    "task.delete",
                    targetId="absent",
                    expectedVersion=1,
                ),
            ),
            actor="desktop",
        )

    assert stale.value.code == "version_conflict"
    assert stale.value.target_id == task_id
    assert missing.value.code == "target_missing"
    assert missing.value.target_id == "absent"


def test_repeated_idempotency_key_returns_original_result(tmp_path) -> None:
    database, executor = setup_executor(tmp_path)
    request = batch(
        "same-key",
        operation(
            "task.create",
            draft={
                "kind": "cycle",
                "generation_mode": "fixed",
                "content": content("Once"),
                "entries": [],
            },
        ),
    )

    first = executor.execute(request, actor="desktop")
    second = executor.execute(request, actor="desktop")

    assert second == first
    assert len(rows(database, "tasks")) == 1
    assert rows(database, "app_meta")[0]["server_revision"] == 1
    assert len(rows(database, "audit_events")) == 1


def test_same_idempotency_key_with_new_request_is_validation_error(
    tmp_path,
) -> None:
    database, executor = setup_executor(tmp_path)
    executor.execute(
        batch("key", operation("task.create", draft={
            "kind": "cycle",
            "generation_mode": "fixed",
            "content": content("First"),
            "entries": [],
        })),
        actor="desktop",
    )

    with pytest.raises(MutationError) as captured:
        executor.execute(
            batch("key", operation("task.create", draft={
                "kind": "cycle",
                "generation_mode": "fixed",
                "content": content("Different"),
                "entries": [],
            })),
            actor="desktop",
        )

    assert captured.value.code == "validation_failed"
    assert len(rows(database, "tasks")) == 1


def test_expected_server_revision_allows_matching_empty_remote(tmp_path) -> None:
    database, executor = setup_executor(tmp_path)
    result = executor.execute(
        batch(
            "expected",
            operation("task.create", draft={
                "kind": "cycle", "generation_mode": "fixed",
                "content": content("Expected"), "entries": [],
            }),
            expected_server_revision=0,
        ),
        actor="desktop",
    )

    assert result.serverRevision == 1
    assert len(rows(database, "tasks")) == 1


def test_stale_expected_server_revision_rolls_back_before_dispatch(tmp_path) -> None:
    database, executor = setup_executor(tmp_path)
    create_cycle(executor)

    with pytest.raises(MutationError) as captured:
        executor.execute(
            batch(
                "stale-revision",
                operation("task.create", draft={
                    "kind": "cycle", "generation_mode": "fixed",
                    "content": content("Blocked"), "entries": [],
                }),
                expected_server_revision=0,
            ),
            actor="desktop",
        )

    assert captured.value.code == "version_conflict"
    assert len(rows(database, "tasks")) == 1
    assert len(rows(database, "audit_events")) == 1
    assert len(rows(database, "idempotency_records")) == 1
    assert rows(database, "app_meta")[0]["server_revision"] == 1


def test_cached_revision_guarded_request_replays_after_revision_advance(tmp_path) -> None:
    database, executor = setup_executor(tmp_path)
    request = batch(
        "replay",
        operation("task.create", draft={
            "kind": "cycle", "generation_mode": "fixed",
            "content": content("Once"), "entries": [],
        }),
        expected_server_revision=0,
    )
    first = executor.execute(request, actor="desktop")
    executor.execute(
        batch("unrelated", operation("task.create", draft={
            "kind": "cycle", "generation_mode": "fixed",
            "content": content("Other"), "entries": [],
        })),
        actor="desktop",
    )

    assert executor.execute(request, actor="desktop") == first
    assert len(rows(database, "tasks")) == 2
    assert rows(database, "app_meta")[0]["server_revision"] == 2


def test_expected_server_revision_is_strict_and_part_of_request_hash() -> None:
    payload = {
        "idempotencyKey": "revision-hash",
        "operations": [operation("task.create", draft={
            "kind": "cycle", "generation_mode": "fixed",
            "content": content("Hash"), "entries": [],
        })],
    }
    zero = MutationBatch.model_validate({**payload, "expectedServerRevision": 0})
    one = MutationBatch.model_validate({**payload, "expectedServerRevision": 1})

    assert zero.request_hash() != one.request_hash()
    for value in (-1, 1.5, "0"):
        with pytest.raises(ValidationError):
            MutationBatch.model_validate({**payload, "expectedServerRevision": value})
