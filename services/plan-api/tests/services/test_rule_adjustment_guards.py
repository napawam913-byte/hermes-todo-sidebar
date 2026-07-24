"""模块用途：验证规则调整不会绕过任务类型与生成元数据边界。"""

import pytest

from plan_api.contracts.mutations import MutationError
from plan_api.contracts.tasks import GenerationMode, TaskStatus
from plan_api.services.mutation_executor import MutationExecutor

from mutation_helpers import batch, entry_draft, operation, setup_executor
from test_rolling_generator import (
    content,
    entry_rows,
    insert_cycle,
    schedule_rule,
    setup_generator,
)


@pytest.mark.parametrize(
    ("status", "mode"),
    [
        (TaskStatus.PAUSED, GenerationMode.ROLLING),
        (TaskStatus.ARCHIVED, GenerationMode.ROLLING),
        (TaskStatus.ACTIVE, GenerationMode.FIXED),
    ],
)
def test_schedule_rule_update_rejects_ineligible_cycle_tasks(
    tmp_path, status: TaskStatus, mode: GenerationMode
) -> None:
    database, repository, _ = setup_generator(tmp_path)
    task_id = insert_cycle(
        database,
        repository,
        rule=schedule_rule("Old"),
        status=status,
        mode=mode,
    )
    executor = MutationExecutor(database)

    with pytest.raises(MutationError) as captured:
        executor.execute(
            batch("adjust-ineligible", operation(
                "task.update",
                targetId=task_id,
                expectedVersion=1,
                patch={
                    "scheduleRule": schedule_rule("New").model_dump(mode="json")
                },
            )),
            actor="desktop",
        )

    assert captured.value.code == "validation_failed"
    assert entry_rows(database, task_id) == []


def test_schedule_rule_update_rejects_daily_task_without_extra_entries(
    tmp_path,
) -> None:
    database, executor = setup_executor(tmp_path)
    created = executor.execute(
        batch("daily", operation("task.create", draft={
            "kind": "daily",
            "generation_mode": "fixed",
            "content": content("Daily"),
            "entries": [entry_draft()],
        })),
        actor="desktop",
    )
    task_id = created.changedTaskIds[0]

    with pytest.raises(MutationError) as captured:
        executor.execute(
            batch("daily-rule", operation(
                "task.update",
                targetId=task_id,
                expectedVersion=1,
                patch={
                    "generationMode": "rolling",
                    "scheduleRule": schedule_rule("New").model_dump(mode="json"),
                },
            )),
            actor="desktop",
        )

    assert captured.value.code == "validation_failed"
    assert len(entry_rows(database, task_id)) == 1


def test_schedule_rule_update_rejects_generated_through_override(
    tmp_path,
) -> None:
    database, executor = setup_executor(tmp_path)
    task_id = _create_rolling_task(executor)

    with pytest.raises(MutationError) as captured:
        executor.execute(
            batch("bad-metadata", operation(
                "task.update",
                targetId=task_id,
                expectedVersion=1,
                patch={
                    "scheduleRule": schedule_rule("New").model_dump(mode="json"),
                    "generatedThroughDate": "2030-01-01",
                },
            )),
            actor="desktop",
        )

    assert captured.value.code == "validation_failed"
    assert entry_rows(database, task_id) == []


def test_schedule_rule_update_rejects_generation_mode_mix(tmp_path) -> None:
    database, executor = setup_executor(tmp_path)
    task_id = _create_rolling_task(executor)

    with pytest.raises(MutationError) as captured:
        executor.execute(
            batch("mixed-mode", operation(
                "task.update",
                targetId=task_id,
                expectedVersion=1,
                patch={
                    "generationMode": "fixed",
                    "scheduleRule": schedule_rule("New").model_dump(mode="json"),
                },
            )),
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
