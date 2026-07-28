"""模块用途：限制 Hermes 提案只能创建或调整一个周期任务。"""

import sqlite3

from ..contracts.mutations import (
    EntryComplete,
    EntryCreate,
    EntryDelete,
    EntryReopen,
    EntrySkip,
    EntryUpdate,
    MutationError,
    TaskCreate,
    TaskDelete,
    TaskSetStatus,
    TaskUpdate,
)
from ..contracts.proposals import ProposalCreateRequest
from ..contracts.tasks import EntrySource, TaskKind


EntryChange = (
    EntryUpdate | EntryComplete | EntryReopen | EntrySkip | EntryDelete
)


class ProposalScopeValidator:
    def validate(
        self,
        connection: sqlite3.Connection,
        request: ProposalCreateRequest,
    ) -> None:
        if request.targetTaskId is None:
            self._validate_create(request)
            return
        target = connection.execute(
            "SELECT kind, version FROM tasks WHERE id = ?",
            (request.targetTaskId,),
        ).fetchone()
        if target is None:
            raise MutationError("target_missing")
        if target["kind"] != TaskKind.CYCLE.value:
            raise MutationError("permission_denied")
        if target["version"] != request.targetVersion:
            raise MutationError("version_conflict")
        for operation in request.operations:
            self._validate_adjustment(
                connection, request.targetTaskId, request.targetVersion,
                operation,
            )

    @staticmethod
    def _validate_create(request: ProposalCreateRequest) -> None:
        if len(request.operations) != 1:
            raise MutationError("permission_denied")
        operation = request.operations[0]
        if not isinstance(operation, TaskCreate):
            raise MutationError("permission_denied")
        if operation.draft.kind is not TaskKind.CYCLE:
            raise MutationError("permission_denied")
        if any(
            entry.source is not EntrySource.HERMES
            for entry in operation.draft.entries
        ):
            raise MutationError("permission_denied")

    def _validate_adjustment(
        self,
        connection: sqlite3.Connection,
        target_id: str,
        target_version: int,
        operation: object,
    ) -> None:
        if isinstance(operation, (TaskUpdate, TaskSetStatus, TaskDelete)):
            if (
                operation.targetId != target_id
                or operation.expectedVersion != target_version
            ):
                raise MutationError("permission_denied")
            return
        if isinstance(operation, EntryCreate):
            if (
                operation.taskId != target_id
                or operation.draft.source is not EntrySource.HERMES
            ):
                raise MutationError("permission_denied")
            return
        if isinstance(
            operation,
            (EntryUpdate, EntryComplete, EntryReopen, EntrySkip, EntryDelete),
        ):
            self._validate_entry(connection, target_id, operation)
            return
        raise MutationError("permission_denied")

    @staticmethod
    def _validate_entry(
        connection: sqlite3.Connection,
        target_id: str,
        operation: EntryChange,
    ) -> None:
        row = connection.execute(
            """
            SELECT task_id, version FROM task_entries WHERE id = ?
            """,
            (operation.targetId,),
        ).fetchone()
        if row is None:
            raise MutationError("target_missing")
        if row["task_id"] != target_id:
            raise MutationError("permission_denied")
        if row["version"] != operation.expectedVersion:
            raise MutationError("version_conflict")
        if (
            isinstance(operation, EntryUpdate)
            and operation.patch.source is not None
            and operation.patch.source is not EntrySource.HERMES
        ):
            raise MutationError("permission_denied")
