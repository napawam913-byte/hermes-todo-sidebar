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

from .content import ContentDocument, validate_content_payload


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
        if isinstance(value, ContentDocument):
            value = value.model_dump(mode="json")
        return validate_content_payload(value)


class ScheduleRuleV1(ScheduleContractModel):
    schemaVersion: Literal[1]
    timezone: Literal["Asia/Shanghai"]
    horizonDays: Literal[7]
    slots: tuple[ScheduleSlotV1, ...] = Field(min_length=1, max_length=200)

    @model_validator(mode="after")
    def require_unique_slot_keys(self) -> "ScheduleRuleV1":
        if len(self.slots) != len({slot.slotKey for slot in self.slots}):
            raise ValueError("duplicate_slot_keys")
        return self


def validate_schedule_rule_payload(payload: object) -> ScheduleRuleV1 | None:
    if payload is None:
        return None
    if isinstance(payload, ScheduleRuleV1):
        payload = payload.model_dump(mode="json")
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
        validated.model_dump(mode="json"),
        ensure_ascii=False,
        allow_nan=False,
        separators=(",", ":"),
    )
