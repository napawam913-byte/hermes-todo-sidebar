"""模块用途：在执行前检查跨 operation 的 mutation 批次约束。"""

from ..contracts.mutations import MutationBatch, MutationError, TaskUpdate


def validate_batch_invariants(batch: MutationBatch) -> None:
    rule_targets: set[str] = set()
    metadata_targets: set[str] = set()
    for operation in batch.operations:
        if not isinstance(operation, TaskUpdate):
            continue
        changed = operation.patch.model_fields_set
        if "scheduleRule" in changed:
            rule_targets.add(operation.targetId)
        if "generationMode" in changed or "generatedThroughDate" in changed:
            metadata_targets.add(operation.targetId)
    if rule_targets & metadata_targets:
        raise MutationError("validation_failed")
