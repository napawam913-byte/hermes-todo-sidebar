from datetime import date, datetime, timedelta, timezone
from enum import Enum
import json
from typing import Any, Self

from pydantic import BaseModel, ConfigDict, field_validator, model_validator

from .content import ContentDocument, validate_content_payload
from ..validation.json_bounds import enforce_json_bounds


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

    @field_validator("completed_at")
    @classmethod
    def normalize_completed_at(cls, value: datetime | None) -> datetime | None:
        return None if value is None else normalize_utc(value)


class TaskDraft(ContractModel):
    kind: TaskKind
    status: TaskStatus = TaskStatus.ACTIVE
    generation_mode: GenerationMode
    content: ContentDocument
    schedule_rule: dict[str, Any] | None = None
    generated_through_date: date | None = None
    rule_revision: int = 1
    entries: tuple[TaskEntryDraft, ...] = ()

    @field_validator("schedule_rule")
    @classmethod
    def validate_schedule_rule(
        cls, value: dict[str, Any] | None
    ) -> dict[str, Any] | None:
        return validate_schedule_rule_payload(value)

    @model_validator(mode="after")
    def require_daily_entry(self) -> Self:
        if self.kind is TaskKind.DAILY and len(self.entries) != 1:
            raise ValueError("daily_requires_one_entry")
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
    schedule_rule: dict[str, Any] | None
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


def load_schedule_rule_json(raw: str | None) -> dict[str, Any] | None:
    if raw is None:
        return None
    try:
        payload = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        raise ValueError("invalid_schedule_rule") from None
    return validate_schedule_rule_payload(payload)


def validate_schedule_rule_payload(
    payload: object,
) -> dict[str, Any] | None:
    if payload is None:
        return None
    try:
        enforce_json_bounds(
            payload, max_bytes=65536, max_depth=8, max_array=200
        )
    except ValueError:
        raise ValueError("invalid_schedule_rule") from None
    if not isinstance(payload, dict):
        raise ValueError("invalid_schedule_rule")
    return payload


def dump_json(payload: object) -> str:
    return json.dumps(
        payload, ensure_ascii=False, allow_nan=False, separators=(",", ":")
    )


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
