from datetime import date
from enum import Enum
import hashlib
import json
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StrictInt
from pydantic import field_validator, model_validator

from .content import ContentDocument, validate_content_payload
from .schedule_rules import ScheduleRuleV1, validate_schedule_rule_payload
from .tasks import EntrySource, GenerationMode, TaskDraft, TaskEntryDraft
from .tasks import TaskStatus


class MutationContract(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class Actor(str, Enum):
    DESKTOP = "desktop"
    HERMES = "hermes"
    SYSTEM = "system"


class MutationErrorCode(str, Enum):
    TARGET_MISSING = "target_missing"
    VERSION_CONFLICT = "version_conflict"
    VALIDATION_FAILED = "validation_failed"
    PERMISSION_DENIED = "permission_denied"
    PERSISTENCE_FAILED = "persistence_failed"


class MutationError(Exception):
    def __init__(
        self,
        code: MutationErrorCode | str,
        *,
        target_id: str | None = None,
        message: str | None = None,
    ) -> None:
        self.code = MutationErrorCode(code)
        self.target_id = target_id
        self.message = message or self.code.value
        super().__init__(self.message)


ExpectedVersion = Annotated[StrictInt, Field(ge=1)]
Identifier = Annotated[str, Field(min_length=1, max_length=200)]


class TaskUpdatePatch(MutationContract):
    content: ContentDocument | None = None
    generationMode: GenerationMode | None = None
    scheduleRule: ScheduleRuleV1 | None = None
    generatedThroughDate: date | None = None

    @field_validator("generationMode")
    @classmethod
    def reject_null_generation_mode(
        cls, value: GenerationMode | None
    ) -> GenerationMode:
        if value is None:
            raise ValueError("null_patch_value")
        return value

    @field_validator("content", mode="before")
    @classmethod
    def validate_content(cls, value: object) -> ContentDocument:
        if value is None:
            raise ValueError("invalid_content")
        return validate_content_payload(value)

    @field_validator("scheduleRule", mode="before")
    @classmethod
    def validate_rule(cls, value: object) -> ScheduleRuleV1:
        if value is None:
            raise ValueError("invalid_schedule_rule")
        rule = validate_schedule_rule_payload(value)
        assert rule is not None
        return rule

    @model_validator(mode="after")
    def require_change(self) -> "TaskUpdatePatch":
        if not self.model_fields_set:
            raise ValueError("empty_patch")
        return self


class EntryUpdatePatch(MutationContract):
    scheduledDate: date | None = None
    content: ContentDocument | None = None
    source: EntrySource | None = None
    slotKey: str | None = Field(default=None, max_length=80)
    isOverridden: bool | None = None
    generationRevision: int | None = Field(default=None, ge=1)

    @field_validator("scheduledDate", "source", "isOverridden")
    @classmethod
    def reject_null_values(cls, value: object) -> object:
        if value is None:
            raise ValueError("null_patch_value")
        return value

    @field_validator("content", mode="before")
    @classmethod
    def validate_content(cls, value: object) -> ContentDocument:
        if value is None:
            raise ValueError("invalid_content")
        return validate_content_payload(value)

    @model_validator(mode="after")
    def require_change(self) -> "EntryUpdatePatch":
        if not self.model_fields_set:
            raise ValueError("empty_patch")
        return self


class TaskCreate(MutationContract):
    type: Literal["task.create"]
    draft: TaskDraft


class TaskUpdate(MutationContract):
    type: Literal["task.update"]
    targetId: Identifier
    expectedVersion: ExpectedVersion
    patch: TaskUpdatePatch


class TaskSetStatus(MutationContract):
    type: Literal["task.setStatus"]
    targetId: Identifier
    expectedVersion: ExpectedVersion
    status: TaskStatus


class TaskDelete(MutationContract):
    type: Literal["task.delete"]
    targetId: Identifier
    expectedVersion: ExpectedVersion


class EntryCreate(MutationContract):
    type: Literal["entry.create"]
    taskId: Identifier
    draft: TaskEntryDraft


class EntryUpdate(MutationContract):
    type: Literal["entry.update"]
    targetId: Identifier
    expectedVersion: ExpectedVersion
    patch: EntryUpdatePatch


class EntryVersionOperation(MutationContract):
    targetId: Identifier
    expectedVersion: ExpectedVersion


class EntryComplete(EntryVersionOperation):
    type: Literal["entry.complete"]


class EntryReopen(EntryVersionOperation):
    type: Literal["entry.reopen"]


class EntrySkip(EntryVersionOperation):
    type: Literal["entry.skip"]


class EntryDelete(EntryVersionOperation):
    type: Literal["entry.delete"]


MutationOperation = Annotated[
    TaskCreate
    | TaskUpdate
    | TaskSetStatus
    | TaskDelete
    | EntryCreate
    | EntryUpdate
    | EntryComplete
    | EntryReopen
    | EntrySkip
    | EntryDelete,
    Field(discriminator="type"),
]


class MutationBatch(MutationContract):
    idempotencyKey: Identifier
    operations: tuple[MutationOperation, ...] = Field(min_length=1, max_length=100)

    def request_hash(self) -> str:
        payload = [item.model_dump(mode="json") for item in self.operations]
        encoded = json.dumps(
            payload,
            ensure_ascii=False,
            allow_nan=False,
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8")
        return hashlib.sha256(encoded).hexdigest()


class MutationResult(MutationContract):
    serverRevision: int = Field(ge=0)
    changedTaskIds: tuple[str, ...] = ()
    changedEntryIds: tuple[str, ...] = ()
