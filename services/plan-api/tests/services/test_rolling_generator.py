"""模块用途：验证滚动规则在固定七天窗口内的确定性生成行为。"""

from datetime import date, datetime, timezone

import pytest
from pydantic import ValidationError

from plan_api.contracts.schedule_rules import ScheduleRuleV1
from plan_api.contracts.tasks import (
    GenerationMode,
    TaskDraft,
    TaskKind,
    TaskStatus,
)
from plan_api.db.database import Database
from plan_api.db.migrations import apply_migrations
from plan_api.repositories.task_repository import TaskRepository
from plan_api.services.rolling_generator import RollingGenerator


TODAY = date(2026, 7, 23)
NOW = datetime(2026, 7, 23, 1, 2, 3, tzinfo=timezone.utc)


def content(title: str) -> dict[str, object]:
    return {
        "schemaVersion": 1,
        "kind": "test.plan",
        "title": title,
        "summary": "Rolling generator test content.",
        "locale": "en-US",
        "sections": [],
    }


def schedule_rule(
    title: str = "Daily slot",
    *,
    cadence: dict[str, object] | None = None,
) -> ScheduleRuleV1:
    return ScheduleRuleV1.model_validate({
        "schemaVersion": 1,
        "timezone": "Asia/Shanghai",
        "horizonDays": 7,
        "slots": [{
            "slotKey": "primary",
            "cadence": cadence or {"type": "daily"},
            "content": content(title),
        }],
    })


def setup_generator(tmp_path):
    database = Database(tmp_path / "plan.db")
    apply_migrations(database)
    identifiers = iter(f"rolling-{number}" for number in range(1, 100))
    repository = TaskRepository(clock=lambda: NOW, id_factory=identifiers.__next__)
    generator = RollingGenerator(
        database,
        repository,
        clock=lambda: NOW,
        id_factory=identifiers.__next__,
    )
    return database, repository, generator


def insert_cycle(
    database: Database,
    repository: TaskRepository,
    *,
    rule: ScheduleRuleV1 | None,
    status: TaskStatus = TaskStatus.ACTIVE,
    mode: GenerationMode = GenerationMode.ROLLING,
) -> str:
    draft = TaskDraft(
        kind=TaskKind.CYCLE,
        status=status,
        generation_mode=mode,
        content=content("Task"),
        schedule_rule=rule,
    )
    with database.transaction() as connection:
        return repository.insert_task(connection, draft)


def entry_rows(database: Database, task_id: str) -> list[dict[str, object]]:
    with database.connect() as connection:
        return [
            dict(row)
            for row in connection.execute(
                "SELECT * FROM task_entries WHERE task_id = ? "
                "ORDER BY scheduled_date",
                (task_id,),
            )
        ]


def test_daily_rule_creates_seven_metadata_preserving_entries(tmp_path) -> None:
    database, repository, generator = setup_generator(tmp_path)
    task_id = insert_cycle(
        database, repository, rule=schedule_rule("Snapshot")
    )

    result = generator.ensure_window(TODAY)
    entries = entry_rows(database, task_id)

    assert result.createdEntryIds == tuple(row["id"] for row in entries)
    assert [row["scheduled_date"] for row in entries] == [
        f"2026-07-{day:02d}" for day in range(23, 30)
    ]
    assert {row["source"] for row in entries} == {"rule_generated"}
    assert {row["slot_key"] for row in entries} == {"primary"}
    assert {row["generation_revision"] for row in entries} == {1}
    assert all('"title":"Snapshot"' in row["content_json"] for row in entries)

    second = generator.ensure_window(TODAY)
    assert second.createdEntryIds == ()
    assert len(entry_rows(database, task_id)) == 7


def test_weekly_rule_uses_iso_weekdays(tmp_path) -> None:
    database, repository, generator = setup_generator(tmp_path)
    task_id = insert_cycle(
        database,
        repository,
        rule=schedule_rule(
            cadence={"type": "weekly", "weekdays": [1, 4, 7]}
        ),
    )

    generator.ensure_window(TODAY)

    assert [row["scheduled_date"] for row in entry_rows(database, task_id)] == [
        "2026-07-23",
        "2026-07-26",
        "2026-07-27",
    ]


@pytest.mark.parametrize(
    ("status", "mode", "has_rule"),
    [
        (TaskStatus.PAUSED, GenerationMode.ROLLING, True),
        (TaskStatus.ARCHIVED, GenerationMode.ROLLING, True),
    ],
)
def test_ineligible_tasks_are_ignored(
    tmp_path, status: TaskStatus, mode: GenerationMode, has_rule: bool
) -> None:
    database, repository, generator = setup_generator(tmp_path)
    task_id = insert_cycle(
        database,
        repository,
        rule=schedule_rule() if has_rule else None,
        status=status,
        mode=mode,
    )

    result = generator.ensure_window(TODAY)

    assert result.createdEntryIds == ()
    assert entry_rows(database, task_id) == []


def test_rule_rejects_non_seven_day_horizon() -> None:
    payload = schedule_rule().model_dump(mode="json")
    payload["horizonDays"] = 8

    with pytest.raises(ValidationError):
        ScheduleRuleV1.model_validate(payload)
