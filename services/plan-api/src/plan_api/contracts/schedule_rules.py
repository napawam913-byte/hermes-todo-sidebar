import json
from typing import Annotated, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StrictInt,
    field_validator,
    model_validator,
)

from ..validation.json_bounds import enforce_json_bounds
from .content import (
    ContentDocument,
    content_payload_snapshot,
    validate_content_payload,
)


class ScheduleContractModel(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class DailyCadence(ScheduleContractModel):
    type: Literal["daily"]


Weekday = Annotated[StrictInt, Field(ge=1, le=7)]


class WeeklyCadence(ScheduleContractModel):
    type: Literal["weekly"]
    weekdays: tuple[Weekday, ...] = Field(min_length=1)

    @field_validator("weekdays")
    @classmethod
    def require_unique_weekdays(cls, value: tuple[int, ...]) -> tuple[int, ...]:
        if len(value) != len(set(value)):
            raise ValueError("duplicate_weekdays")
        return value


Cadence = Annotated[
    DailyCadence | WeeklyCadence,
    Field(discriminator="type"),
]


class ScheduleSlotV1(ScheduleContractModel):
    slotKey: str = Field(min_length=1, max_length=80)
    cadence: Cadence
    content: ContentDocument

    @field_validator("content", mode="before")
    @classmethod
    def enforce_content_bounds(cls, value: object) -> ContentDocument:
        return validate_content_payload(value)


class ScheduleRuleV1(ScheduleContractModel):
    schemaVersion: Literal[1]
    timezone: Literal["Asia/Shanghai"]
    horizonDays: Literal[7]
    slots: tuple[ScheduleSlotV1, ...] = Field(min_length=1, max_length=200)

    @model_validator(mode="before")
    @classmethod
    def reject_custom_json_containers(cls, value: object) -> object:
        if not isinstance(value, ScheduleRuleV1):
            enforce_json_bounds(
                _snapshot_content_documents(value),
                max_bytes=1048576,
                max_depth=10,
                max_array=200,
            )
        return value

    @field_validator("schemaVersion", "horizonDays", mode="before")
    @classmethod
    def require_exact_json_int(cls, value: object) -> object:
        if type(value) is not int:
            raise ValueError("strict_int_required")
        return value

    @model_validator(mode="after")
    def require_unique_slot_keys(self) -> "ScheduleRuleV1":
        if len(self.slots) != len({slot.slotKey for slot in self.slots}):
            raise ValueError("duplicate_slot_keys")
        return self


def validate_schedule_rule_payload(payload: object) -> ScheduleRuleV1 | None:
    if payload is None:
        return None
    if isinstance(payload, ScheduleRuleV1):
        payload = schedule_rule_payload_snapshot(payload)
    try:
        return ScheduleRuleV1.model_validate(payload)
    except ValueError:
        raise ValueError("invalid_schedule_rule") from None


def serialize_validated_schedule_rule(rule: ScheduleRuleV1 | None) -> str | None:
    if rule is None:
        return None
    validated = validate_schedule_rule_payload(rule)
    assert validated is not None
    return json.dumps(
        validated.model_dump(mode="json", warnings="error"),
        ensure_ascii=False,
        allow_nan=False,
        separators=(",", ":"),
    )


def schedule_rule_payload_snapshot(rule: ScheduleRuleV1) -> dict[str, object]:
    """Copy rule fields without coercing raw values inside slot content."""
    return {
        "schemaVersion": rule.schemaVersion,
        "timezone": rule.timezone,
        "horizonDays": rule.horizonDays,
        "slots": [
            {
                "slotKey": slot.slotKey,
                "cadence": _cadence_snapshot(slot.cadence),
                "content": content_payload_snapshot(slot.content),
            }
            for slot in rule.slots
        ],
    }


def _cadence_snapshot(cadence: Cadence) -> dict[str, object]:
    if isinstance(cadence, WeeklyCadence):
        return {"type": cadence.type, "weekdays": list(cadence.weekdays)}
    return {"type": cadence.type}


def _snapshot_content_documents(value: object) -> object:
    if isinstance(value, ContentDocument):
        return content_payload_snapshot(value)
    if type(value) is list:
        return [_snapshot_content_documents(item) for item in value]
    if type(value) is dict:
        return {
            key: _snapshot_content_documents(item)
            for key, item in value.items()
        }
    return value
