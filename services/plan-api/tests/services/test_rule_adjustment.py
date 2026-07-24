"""模块用途：验证规则替换的保留边界、计数与 mutation 接线。"""

from datetime import date

import pytest

from plan_api.contracts.mutations import MutationError
from plan_api.services.rule_adjustment import RuleAdjustmentService

from mutation_helpers import batch, operation, setup_executor
from test_rolling_generator import (
    TODAY,
    content,
    entry_rows,
    insert_cycle,
    schedule_rule,
    setup_generator,
)


def test_replace_future_preserves_exceptions_and_reports_counts(tmp_path) -> None:
    database, repository, generator = setup_generator(tmp_path)
    task_id = insert_cycle(database, repository, rule=schedule_rule("Old"))
    other_id = insert_cycle(database, repository, rule=schedule_rule("Other"))
    generator.ensure_window(TODAY)
    original = entry_rows(database, task_id)
    other_before = entry_rows(database, other_id)
    preserved_ids = _mark_preserved_rows(database, original)
    _insert_historical(database, task_id)
    with database.connect() as connection:
        task = repository.get_task(connection, task_id)
    assert task is not None
    service = RuleAdjustmentService(repository, generator)

    with database.transaction() as connection:
        result = service.replace_future(
            connection,
            task,
            schedule_rule(
                "New",
                cadence={"type": "weekly", "weekdays": [4, 5]},
            ),
            expected_version=1,
            today=TODAY,
        )

    rows = entry_rows(database, task_id)
    ids = {row["id"] for row in rows}
    assert result.added == 1
    assert result.removed == 4
    assert result.replaced == 1
    assert preserved_ids <= ids
    assert any(row["scheduled_date"] == "2026-07-22" for row in rows)
    assert entry_rows(database, other_id) == other_before
    new_rows = [
        row for row in rows if row["generation_revision"] == 2
    ]
    assert [(row["scheduled_date"], row["source"]) for row in new_rows] == [
        ("2026-07-23", "rule_generated")
    ]
    with database.connect() as connection:
        updated = repository.get_task(connection, task_id)
    assert updated is not None
    assert updated.version == 2
    assert updated.rule_revision == 2
    assert updated.schedule_rule.slots[0].content.title == "New"


def test_replace_future_rejects_stale_version_without_writes(tmp_path) -> None:
    database, repository, generator = setup_generator(tmp_path)
    task_id = insert_cycle(database, repository, rule=schedule_rule("Old"))
    generator.ensure_window(TODAY)
    before = entry_rows(database, task_id)
    with database.connect() as connection:
        task = repository.get_task(connection, task_id)
    assert task is not None

    with pytest.raises(MutationError) as captured:
        with database.transaction() as connection:
            RuleAdjustmentService(repository, generator).replace_future(
                connection,
                task,
                schedule_rule("New"),
                expected_version=99,
                today=TODAY,
            )

    assert captured.value.code == "version_conflict"
    assert entry_rows(database, task_id) == before


def test_invalid_mutated_rule_rolls_back_deletes_and_task_update(tmp_path) -> None:
    database, repository, generator = setup_generator(tmp_path)
    task_id = insert_cycle(database, repository, rule=schedule_rule("Old"))
    generator.ensure_window(TODAY)
    before = entry_rows(database, task_id)
    with database.connect() as connection:
        task = repository.get_task(connection, task_id)
    assert task is not None
    invalid = schedule_rule("New")
    object.__setattr__(invalid.slots[0].content, "title", "")

    with pytest.raises(ValueError):
        with database.transaction() as connection:
            RuleAdjustmentService(repository, generator).replace_future(
                connection, task, invalid, 1, TODAY
            )

    assert entry_rows(database, task_id) == before
    with database.connect() as connection:
        unchanged = repository.get_task(connection, task_id)
    assert unchanged is not None
    assert unchanged.version == 1
    assert unchanged.schedule_rule.slots[0].content.title == "Old"


def test_task_update_schedule_rule_regenerates_but_content_does_not(
    tmp_path,
) -> None:
    database, executor = setup_executor(tmp_path)
    created = executor.execute(
        batch(
            "rolling-create",
            operation(
                "task.create",
                draft={
                    "kind": "cycle",
                    "generation_mode": "rolling",
                    "content": content("Task"),
                    "schedule_rule": schedule_rule("Old").model_dump(mode="json"),
                },
            ),
        ),
        actor="desktop",
    )
    task_id = created.changedTaskIds[0]

    content_only = executor.execute(
        batch(
            "rolling-content",
            operation(
                "task.update",
                targetId=task_id,
                expectedVersion=1,
                patch={"content": content("Renamed")},
            ),
        ),
        actor="desktop",
    )
    assert content_only.changedEntryIds == ()
    assert entry_rows(database, task_id) == []

    adjusted = executor.execute(
        batch(
            "rolling-adjust",
            operation(
                "task.update",
                targetId=task_id,
                expectedVersion=2,
                patch={
                    "scheduleRule": schedule_rule("New").model_dump(mode="json")
                },
            ),
        ),
        actor="desktop",
    )

    assert len(adjusted.changedEntryIds) == 7
    assert len(entry_rows(database, task_id)) == 7


def test_replace_future_removes_old_revision_when_override_cleared(
    tmp_path,
) -> None:
    database, repository, generator = setup_generator(tmp_path)
    task_id = insert_cycle(database, repository, rule=schedule_rule("Old"))
    generator.ensure_window(TODAY)
    original = entry_rows(database, task_id)[0]
    with database.transaction() as connection:
        connection.execute(
            "UPDATE task_entries SET is_overridden = 1 WHERE id = ?",
            (original["id"],),
        )
        task = repository.get_task(connection, task_id)
        assert task is not None
        RuleAdjustmentService(repository, generator).replace_future(
            connection, task, schedule_rule("Middle"), 1, TODAY
        )
        connection.execute(
            "UPDATE task_entries SET is_overridden = 0 WHERE id = ?",
            (original["id"],),
        )
        updated = repository.get_task(connection, task_id)
        assert updated is not None
        RuleAdjustmentService(repository, generator).replace_future(
            connection, updated, schedule_rule("New"), 2, TODAY
        )

    rows = entry_rows(database, task_id)
    assert original["id"] not in {row["id"] for row in rows}
    assert any('"title":"New"' in row["content_json"] for row in rows)
    assert not any('"title":"Old"' in row["content_json"] for row in rows)


def _mark_preserved_rows(
    database, rows: list[dict[str, object]]
) -> set[str]:
    changes = [
        ("completed", 0, rows[1]["id"]),
        ("skipped", 0, rows[2]["id"]),
        ("pending", 1, rows[3]["id"]),
    ]
    with database.transaction() as connection:
        for status, overridden, entry_id in changes:
            connection.execute(
                "UPDATE task_entries SET status = ?, is_overridden = ? "
                "WHERE id = ?",
                (status, overridden, entry_id),
            )
    return {str(item[2]) for item in changes}


def _insert_historical(database, task_id: str) -> None:
    with database.transaction() as connection:
        source = connection.execute(
            "SELECT * FROM task_entries WHERE task_id = ? "
            "ORDER BY scheduled_date LIMIT 1",
            (task_id,),
        ).fetchone()
        connection.execute(
            """
            INSERT INTO task_entries
            SELECT 'history-entry', task_id, ?, status, content_json, source,
                   slot_key, is_overridden, generation_revision, version,
                   created_at, updated_at, completed_at
            FROM task_entries WHERE id = ?
            """,
            (date(2026, 7, 22).isoformat(), source["id"]),
        )
