import pytest
from pydantic import ValidationError

from plan_api.contracts.schedule_rules import ScheduleRuleV1


class CustomList(list):
    pass


class CustomDict(dict):
    pass


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("schemaVersion", True),
        ("schemaVersion", 1.0),
        ("schemaVersion", "1"),
        ("horizonDays", True),
        ("horizonDays", 7.0),
        ("horizonDays", "7"),
    ],
)
def test_fixed_integer_fields_require_exact_json_int(
    field: str, value: object
) -> None:
    payload = _rule_payload()
    payload[field] = value

    with pytest.raises(ValidationError, match="strict_int_required"):
        ScheduleRuleV1.model_validate(payload)


@pytest.mark.parametrize("field", ["root", "slots", "weekdays"])
def test_rule_rejects_custom_structure_containers(field: str) -> None:
    payload = _rule_payload()
    if field == "root":
        payload = CustomDict(payload)
    elif field == "slots":
        payload["slots"] = CustomList(payload["slots"])
    else:
        payload["slots"][0]["cadence"]["weekdays"] = CustomList([1])

    with pytest.raises(ValidationError, match="content_not_json"):
        ScheduleRuleV1.model_validate(payload)


def _rule_payload() -> dict[str, object]:
    return {
        "schemaVersion": 1,
        "timezone": "Asia/Shanghai",
        "horizonDays": 7,
        "slots": [{
            "slotKey": "strength",
            "cadence": {"type": "weekly", "weekdays": [1, 3, 5]},
            "content": {
                "schemaVersion": 1,
                "kind": "test.task",
                "title": "Strength",
                "summary": "Fixed test content.",
                "locale": "en-US",
                "sections": [],
            },
        }],
    }
