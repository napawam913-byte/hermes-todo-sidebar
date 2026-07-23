from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .content import ContentDocument, validate_content_payload


class ScheduleContractModel(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class DailyCadence(ScheduleContractModel):
    type: Literal["daily"]


Weekday = Annotated[int, Field(ge=1, le=7)]


class WeeklyCadence(ScheduleContractModel):
    type: Literal["weekly"]
    weekdays: tuple[Weekday, ...] = Field(min_length=1)


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
