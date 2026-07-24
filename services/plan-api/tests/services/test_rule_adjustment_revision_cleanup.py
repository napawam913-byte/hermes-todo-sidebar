"""模块用途：验证旧 revision 条目恢复可替换后会被规则调整清理。"""

from plan_api.services.rule_adjustment import RuleAdjustmentService

from test_rolling_generator import (
    TODAY,
    entry_rows,
    insert_cycle,
    schedule_rule,
    setup_generator,
)


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
