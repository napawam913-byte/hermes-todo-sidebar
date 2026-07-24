"""模块用途：在执行前检查跨 operation 的 mutation 批次约束。"""

from ..contracts.mutations import (
    MutationBatch,
    MutationError,
    TaskSetStatus,
    TaskUpdate,
)
from ..contracts.tasks import TaskStatus


def validate_batch_invariants(batch: MutationBatch) -> None:
    rule_targets: set[str] = set()
    conflicting_targets: set[str] = set()
    for operation in batch.operations:
        if isinstance(operation, TaskUpdate):
            changed = operation.patch.model_fields_set
            if "scheduleRule" in changed:
                rule_targets.add(operation.targetId)
            if "generationMode" in changed or "generatedThroughDate" in changed:
                conflicting_targets.add(operation.targetId)
        if (
            isinstance(operation, TaskSetStatus)
            and operation.status is not TaskStatus.ACTIVE
        ):
            conflicting_targets.add(operation.targetId)
    if rule_targets & conflicting_targets:
        raise MutationError("validation_failed")
