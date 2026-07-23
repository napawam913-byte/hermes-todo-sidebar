from dataclasses import dataclass

import pytest
from pydantic import BaseModel, ValidationError

from plan_api.contracts.content import ContentDocument
from plan_api.contracts.schedule_rules import (
    ScheduleRuleV1,
    serialize_validated_schedule_rule,
)


@dataclass
class _DataclassValue:
    value: int


class _ModelValue(BaseModel):
    value: int


@pytest.mark.parametrize("value", [_DataclassValue(1), _ModelValue(value=1)])
def test_rule_rejects_pre_mutated_custom_slot_content(value) -> None:
    content = ContentDocument.model_validate(_content_payload("Strength", "safe"))
    content.sections[0].fields[0].value = value
    payload = _rule_payload(content)

    with pytest.raises(ValidationError, match="content_not_json"):
        ScheduleRuleV1.model_validate(payload)


@pytest.mark.parametrize("value", [_DataclassValue(1), _ModelValue(value=1)])
def test_serialization_rejects_custom_object_in_mutated_slot_content(value) -> None:
    rule = ScheduleRuleV1.model_validate(
        _rule_payload(_content_payload("Strength", "safe"))
    )
    rule.slots[0].content.sections[0].fields[0].value = value

    with pytest.raises(ValueError, match="^invalid_schedule_rule$"):
        serialize_validated_schedule_rule(rule)


def _rule_payload(content: object) -> dict[str, object]:
    return {
        "schemaVersion": 1,
        "timezone": "Asia/Shanghai",
        "horizonDays": 7,
        "slots": [{
            "slotKey": "strength",
            "cadence": {"type": "weekly", "weekdays": [1, 3, 5]},
            "content": content,
        }],
    }


def _content_payload(title: str, value: object) -> dict[str, object]:
    return {
        "schemaVersion": 1,
        "kind": "test.task",
        "title": title,
        "summary": "Fixed test content.",
        "locale": "en-US",
        "sections": [{
            "id": "main",
            "label": "Main",
            "layout": "fields",
            "fields": [{
                "key": "detail",
                "label": "Detail",
                "type": "value",
                "value": value,
            }],
        }],
    }
