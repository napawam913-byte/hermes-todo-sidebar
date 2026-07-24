from datetime import date, datetime, timedelta, timezone
from enum import Enum
import json
from typing import Self

from pydantic import BaseModel, ConfigDict, field_validator, model_validator

from .content import ContentDocument, validate_content_payload
from .schedule_rules import ScheduleRuleV1, validate_schedule_rule_payload


class TaskKind(str, Enum):
    DAILY = "daily"
    CYCLE = "cycle"


class TaskStatus(str, Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    ARCHIVED = "archived"


class GenerationMode(str, Enum):
    FIXED = "fixed"
    ROLLING = "rolling"


class EntryStatus(str, Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    SKIPPED = "skipped"


class EntrySource(str, Enum):
    MANUAL = "manual"
    RULE_GENERATED = "rule_generated"
    HERMES = "hermes"


class ContractModel(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class TaskEntryDraft(ContractModel):
    scheduled_date: date
    status: EntryStatus = EntryStatus.PENDING
    content: ContentDocument
    source: EntrySource = EntrySource.MANUAL
    slot_key: str | None = None
    is_overridden: bool = False
    generation_revision: int | None = None
    completed_at: datetime | None = None

    @field_validator("content", mode="before")
    @classmethod
    def enforce_content_bounds(cls, value: object) -> ContentDocument:
        return _validated_content(value)

    @field_validator("completed_at")
    @classmethod
    def normalize_completed_at(cls, value: datetime | None) -> datetime | None:
        return None if value is None else normalize_utc(value)


class TaskDraft(ContractModel):
    kind: TaskKind
    status: TaskStatus = TaskStatus.ACTIVE
    generation_mode: GenerationMode
    content: ContentDocument
    schedule_rule: ScheduleRuleV1 | None = None
    generated_through_date: date | None = None
    rule_revision: int = 1
    entries: tuple[TaskEntryDraft, ...] = ()

    @field_validator("content", mode="before")
    @classmethod
    def enforce_content_bounds(cls, value: object) -> ContentDocument:
        return _validated_content(value)

    @field_validator("schedule_rule", mode="before")
    @classmethod
    def validate_schedule_rule(
        cls, value: object
    ) -> ScheduleRuleV1 | None:
        return validate_schedule_rule_payload(value)

    @model_validator(mode="after")
    def require_task_shape(self) -> Self:
        if self.kind is TaskKind.DAILY and len(self.entries) != 1:
            raise ValueError("daily_requires_one_entry")
        if self.kind is TaskKind.DAILY and self.generation_mode is not GenerationMode.FIXED:
            raise ValueError("daily_requires_fixed_generation")
        if (
            self.generation_mode is GenerationMode.ROLLING
            and self.kind is not TaskKind.CYCLE
        ):
            raise ValueError("rolling_requires_cycle_task")
        if (
            self.generation_mode is GenerationMode.ROLLING
            and self.schedule_rule is None
        ):
            raise ValueError("rolling_requires_schedule_rule")
        if (
            self.generation_mode is GenerationMode.FIXED
            and self.schedule_rule is not None
        ):
            raise ValueError("fixed_rejects_schedule_rule")
        return self


class TaskEntryView(ContractModel):
    id: str
    task_id: str
    scheduled_date: date
    status: EntryStatus
    content: ContentDocument
    source: EntrySource
    slot_key: str | None
    is_overridden: bool
    generation_revision: int | None
    version: int
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None


class TaskView(ContractModel):
    id: str
    kind: TaskKind
    status: TaskStatus
    generation_mode: GenerationMode
    content: ContentDocument
    schedule_rule: ScheduleRuleV1 | None
    generated_through_date: date | None
    rule_revision: int
    version: int
    created_at: datetime
    updated_at: datetime
    entries: tuple[TaskEntryView, ...]


class TodayItem(ContractModel):
    task_kind: TaskKind
    task_status: TaskStatus
    task_content: ContentDocument
    entry: TaskEntryView
    is_overdue: bool


class TodayView(ContractModel):
    target_date: date
    items: tuple[TodayItem, ...]


def load_content_json(raw: str) -> ContentDocument:
    try:
        payload = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        raise ValueError("invalid_content") from None
    return validate_content_payload(payload)


def load_schedule_rule_json(raw: str | None) -> ScheduleRuleV1 | None:
    if raw is None:
        return None
    try:
        payload = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        raise ValueError("invalid_schedule_rule") from None
    return validate_schedule_rule_payload(payload)


def dump_json(payload: object) -> str:
    if isinstance(payload, BaseModel):
        payload = payload.model_dump(mode="json")
    return json.dumps(
        payload, ensure_ascii=False, allow_nan=False, separators=(",", ":")
    )


def _validated_content(value: object) -> ContentDocument:
    return validate_content_payload(value)


def normalize_utc(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("timestamp_requires_timezone")
    return value.astimezone(timezone.utc)


def format_utc(value: datetime) -> str:
    return normalize_utc(value).isoformat(timespec="microseconds").replace(
        "+00:00", "Z"
    )


def parse_utc(raw: str) -> datetime:
    try:
        value = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except (TypeError, ValueError):
        raise ValueError("invalid_utc_timestamp") from None
    if value.tzinfo is None or value.utcoffset() != timedelta(0):
        raise ValueError("invalid_utc_timestamp")
    return value.astimezone(timezone.utc)
