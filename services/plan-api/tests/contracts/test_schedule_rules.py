import json

import pytest
from pydantic import ValidationError

from plan_api.contracts.content import ContentDocument
from plan_api.contracts.schedule_rules import ScheduleRuleV1
from plan_api.contracts.tasks import (
    GenerationMode,
    TaskDraft,
    TaskKind,
    load_schedule_rule_json,
)


def test_accepts_approved_daily_and_weekly_slots() -> None:
    payload = _rule_payload()
    payload["slots"].append(
        {
            "slotKey": "check-in",
            "cadence": {"type": "daily"},
            "content": _content_payload("Daily check-in"),
        }
    )

    rule = ScheduleRuleV1.model_validate(payload)

    assert rule.schemaVersion == 1
    assert rule.timezone == "Asia/Shanghai"
    assert rule.horizonDays == 7
    assert rule.slots[0].cadence.weekdays == (1, 3, 5)
    assert rule.slots[1].cadence.type == "daily"


@pytest.mark.parametrize("case", ["incomplete", "unknown"])
def test_rejects_incomplete_or_unknown_rule_fields(case: str) -> None:
    payload = (
        {"schemaVersion": 1}
        if case == "incomplete"
        else {**_rule_payload(), "unknown": True}
    )

    with pytest.raises(ValidationError):
        ScheduleRuleV1.model_validate(payload)


@pytest.mark.parametrize("case", ["incomplete", "unknown"])
def test_json_loader_rejects_incomplete_or_unknown_rules(case: str) -> None:
    payload = {"schemaVersion": 1} if case == "incomplete" else _rule_payload()
    if case == "unknown":
        payload["unknown"] = True

    with pytest.raises(ValueError, match="^invalid_schedule_rule$"):
        load_schedule_rule_json(json.dumps(payload))


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("schemaVersion", 2),
        ("timezone", "UTC"),
        ("horizonDays", 8),
    ],
)
def test_rejects_non_v1_fixed_values(field: str, value: object) -> None:
    payload = _rule_payload()
    payload[field] = value

    with pytest.raises(ValidationError):
        ScheduleRuleV1.model_validate(payload)


@pytest.mark.parametrize(
    "cadence",
    [
        {"type": "monthly"},
        {"type": "daily", "weekdays": [1]},
        {"type": "weekly", "weekdays": []},
        {"type": "weekly", "weekdays": [0]},
        {"type": "weekly", "weekdays": [8]},
        {"type": "weekly", "weekdays": [1], "unknown": True},
    ],
)
def test_rejects_unsupported_or_invalid_cadence(cadence: object) -> None:
    payload = _rule_payload()
    payload["slots"][0]["cadence"] = cadence

    with pytest.raises(ValidationError):
        ScheduleRuleV1.model_validate(payload)


@pytest.mark.parametrize("weekday", ["1", 1.0, True])
def test_weekly_weekdays_require_strict_json_integers(weekday: object) -> None:
    payload = _rule_payload()
    payload["slots"][0]["cadence"]["weekdays"] = [weekday]

    with pytest.raises(ValidationError):
        ScheduleRuleV1.model_validate(payload)


def test_weekly_weekdays_must_be_unique() -> None:
    payload = _rule_payload()
    payload["slots"][0]["cadence"]["weekdays"] = [1, 3, 3]

    with pytest.raises(ValidationError, match="duplicate_weekdays"):
        ScheduleRuleV1.model_validate(payload)


def test_rule_slot_keys_must_be_unique() -> None:
    payload = _rule_payload()
    payload["slots"].append(
        {
            "slotKey": "strength",
            "cadence": {"type": "daily"},
            "content": _content_payload("Daily strength"),
        }
    )

    with pytest.raises(ValidationError, match="duplicate_slot_keys"):
        ScheduleRuleV1.model_validate(payload)


def test_slot_rechecks_existing_content_document_bounds() -> None:
    oversized = ContentDocument.model_validate(
        _content_payload("Oversized", list(range(201)))
    )
    payload = _rule_payload()
    payload["slots"][0]["content"] = oversized

    with pytest.raises(ValidationError, match="array_too_large"):
        ScheduleRuleV1.model_validate(payload)


def test_task_draft_uses_typed_schedule_rule() -> None:
    draft = TaskDraft(
        kind=TaskKind.CYCLE,
        generation_mode=GenerationMode.ROLLING,
        content=_content_payload("Task"),
        schedule_rule=_rule_payload(),
    )

    assert isinstance(draft.schedule_rule, ScheduleRuleV1)


def _rule_payload() -> dict[str, object]:
    return {
        "schemaVersion": 1,
        "timezone": "Asia/Shanghai",
        "horizonDays": 7,
        "slots": [
            {
                "slotKey": "strength",
                "cadence": {"type": "weekly", "weekdays": [1, 3, 5]},
                "content": _content_payload("Strength"),
            }
        ],
    }


def _content_payload(
    title: str, value: object | None = None
) -> dict[str, object]:
    sections: list[object] = []
    if value is not None:
        sections.append(
            {
                "id": "main",
                "label": "Main",
                "layout": "fields",
                "fields": [
                    {
                        "key": "detail",
                        "label": "Detail",
                        "type": "value",
                        "value": value,
                    }
                ],
            }
        )
    return {
        "schemaVersion": 1,
        "kind": "test.task",
        "title": title,
        "summary": "Fixed test content.",
        "locale": "en-US",
        "sections": sections,
    }
