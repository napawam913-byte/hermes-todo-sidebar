"""模块用途：验证同一批次内规则调整与最终任务状态不会冲突。"""

import pytest

from plan_api.contracts.mutations import MutationError

from mutation_helpers import batch, operation, setup_executor
from test_rolling_generator import content, entry_rows, schedule_rule


def test_batch_rejects_schedule_rule_then_generation_mode_update(
    tmp_path,
) -> None:
    database, executor = setup_executor(tmp_path)
    task_id = _create_rolling_task(executor)

    with pytest.raises(MutationError) as captured:
        executor.execute(
            batch(
                "batch-mode-conflict",
                _schedule_rule_update(task_id),
                operation(
                    "task.update",
                    targetId=task_id,
                    expectedVersion=2,
                    patch={"generationMode": "fixed"},
                ),
            ),
            actor="desktop",
        )

    assert captured.value.code == "validation_failed"
    assert entry_rows(database, task_id) == []


@pytest.mark.parametrize("status", ["paused", "archived"])
def test_batch_rejects_schedule_rule_then_non_active_status(
    tmp_path, status: str
) -> None:
    database, executor = setup_executor(tmp_path)
    task_id = _create_rolling_task(executor)

    with pytest.raises(MutationError) as captured:
        executor.execute(
            batch(
                f"batch-status-{status}",
                _schedule_rule_update(task_id),
                operation(
                    "task.setStatus",
                    targetId=task_id,
                    expectedVersion=2,
                    status=status,
                ),
            ),
            actor="desktop",
        )

    assert captured.value.code == "validation_failed"
    assert entry_rows(database, task_id) == []


def test_batch_rejects_schedule_rule_then_generated_through_update(
    tmp_path,
) -> None:
    database, executor = setup_executor(tmp_path)
    task_id = _create_rolling_task(executor)

    with pytest.raises(MutationError) as captured:
        executor.execute(
            batch(
                "batch-through-conflict",
                _schedule_rule_update(task_id),
                operation(
                    "task.update",
                    targetId=task_id,
                    expectedVersion=2,
                    patch={"generatedThroughDate": "2030-01-01"},
                ),
            ),
            actor="desktop",
        )

    assert captured.value.code == "validation_failed"
    assert entry_rows(database, task_id) == []


def _create_rolling_task(executor) -> str:
    created = executor.execute(
        batch("rolling", operation("task.create", draft={
            "kind": "cycle",
            "generation_mode": "rolling",
            "content": content("Task"),
            "schedule_rule": schedule_rule("Old").model_dump(mode="json"),
        })),
        actor="desktop",
    )
    return created.changedTaskIds[0]


def _schedule_rule_update(task_id: str):
    return operation(
        "task.update",
        targetId=task_id,
        expectedVersion=1,
        patch={"scheduleRule": schedule_rule("New").model_dump(mode="json")},
    )
