"""模块用途：定义 Hermes 提案的严格请求与响应合同。"""

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, StrictInt, model_validator

from .mutations import Identifier, MutationOperation, MutationResult


class ProposalContract(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class ProposalStatus(str, Enum):
    PENDING = "pending"
    APPLIED = "applied"
    CANCELLED = "cancelled"
    EXPIRED = "expired"
    FAILED = "failed"


class ProposalCreateRequest(ProposalContract):
    externalSessionId: Identifier
    idempotencyKey: Identifier
    summary: str = Field(min_length=1, max_length=500)
    operations: tuple[MutationOperation, ...] = Field(
        min_length=1, max_length=50
    )
    targetTaskId: Identifier | None = None
    targetVersion: StrictInt | None = Field(default=None, ge=1)

    @model_validator(mode="after")
    def require_target_pair(self) -> "ProposalCreateRequest":
        if (self.targetTaskId is None) != (self.targetVersion is None):
            raise ValueError("proposal_target_pair_required")
        return self


class ProposalView(ProposalContract):
    id: str
    externalSessionId: str
    summary: str
    operations: tuple[MutationOperation, ...]
    status: ProposalStatus
    expiresAt: datetime
    targetTaskId: str | None
    targetVersion: int | None
    createdAt: datetime
    updatedAt: datetime
    appliedAt: datetime | None


class ProposalTransitionRequest(ProposalContract):
    externalSessionId: Identifier
    idempotencyKey: Identifier


class ProposalConfirmResult(ProposalContract):
    proposal: ProposalView
    mutation: MutationResult
