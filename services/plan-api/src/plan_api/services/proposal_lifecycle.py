"""模块用途：在单事务内读取并转换 Hermes 提案状态。"""

from collections.abc import Callable
from datetime import datetime
import sqlite3

from ..contracts.mutations import (
    MutationBatch,
    MutationError,
    MutationResult,
)
from ..contracts.proposals import (
    ProposalConfirmResult,
    ProposalCreateRequest,
    ProposalStatus,
    ProposalTransitionRequest,
    ProposalView,
)
from ..contracts.tasks import format_utc, parse_utc
from ..db.database import Database
from ..repositories.proposal_repository import ProposalRepository
from .mutation_executor import MutationExecutor


class ProposalLifecycle:
    def __init__(
        self,
        database: Database,
        repository: ProposalRepository,
        mutation_executor: MutationExecutor,
        view_factory: Callable[[sqlite3.Row], ProposalView],
        clock: Callable[[], datetime],
        id_factory: Callable[[], str],
    ) -> None:
        self._database = database
        self._repository = repository
        self._mutation_executor = mutation_executor
        self._view = view_factory
        self._clock = clock
        self._id_factory = id_factory
    def get(
        self, proposal_id: str, external_session_id: str
    ) -> ProposalView:
        try:
            with self._database.connect() as connection:
                row = self._owned(
                    self._repository.get(connection, proposal_id),
                    external_session_id,
                )
                return self._view(row)
        except MutationError:
            raise
        except (sqlite3.Error, ValueError) as error:
            raise MutationError("persistence_failed") from error
    def cancel(
        self,
        proposal_id: str,
        request: ProposalTransitionRequest,
    ) -> ProposalView:
        try:
            with self._database.transaction() as connection:
                row = self._owned(
                    self._repository.get(connection, proposal_id),
                    request.externalSessionId,
                )
                if row["status"] == ProposalStatus.CANCELLED.value:
                    return self._view(row)
                if row["status"] != ProposalStatus.PENDING.value:
                    raise MutationError("validation_failed")
                now = format_utc(self._clock())
                self._repository.mark_cancelled(
                    connection, proposal_id=proposal_id, now=now
                )
                cancelled = self._repository.get(connection, proposal_id)
                assert cancelled is not None
                view = self._view(cancelled)
                self._repository.audit_transition(
                    connection,
                    event_id=self._id_factory(),
                    action="proposal.cancelled",
                    proposal_id=proposal_id,
                    result_json=view.model_dump_json(),
                    now=now,
                )
                return view
        except MutationError:
            raise
        except (sqlite3.Error, ValueError) as error:
            raise MutationError("persistence_failed") from error
    def confirm(
        self,
        proposal_id: str,
        request: ProposalTransitionRequest,
    ) -> ProposalConfirmResult:
        execution_started = False
        try:
            with self._database.transaction() as connection:
                row = self._owned(
                    self._repository.get(connection, proposal_id),
                    request.externalSessionId,
                )
                if row["status"] == ProposalStatus.APPLIED.value:
                    return self._applied_result(connection, row)
                if row["status"] != ProposalStatus.PENDING.value:
                    raise MutationError("validation_failed")
                if parse_utc(row["expires_at"]) <= self._clock():
                    now = format_utc(self._clock())
                    self._repository.mark_terminal(
                        connection,
                        proposal_id=proposal_id,
                        status=ProposalStatus.EXPIRED.value,
                        now=now,
                    )
                    self._repository.audit_transition(
                        connection,
                        event_id=self._id_factory(),
                        action="proposal.expired",
                        proposal_id=proposal_id,
                        result_json='{"code":"proposal_expired"}',
                        now=now,
                    )
                else:
                    execution_started = True
                    return self._apply(
                        connection, row, request, proposal_id
                    )
            raise MutationError("proposal_expired")
        except MutationError as error:
            if execution_started:
                self._mark_failed(
                    proposal_id, request.externalSessionId, error
                )
            raise
        except (sqlite3.Error, ValueError) as error:
            if execution_started:
                self._mark_failed(
                    proposal_id,
                    request.externalSessionId,
                    MutationError("persistence_failed"),
                )
            raise MutationError("persistence_failed") from error
    def _apply(
        self,
        connection: sqlite3.Connection,
        row: sqlite3.Row,
        request: ProposalTransitionRequest,
        proposal_id: str,
    ) -> ProposalConfirmResult:
        proposal = ProposalCreateRequest.model_validate_json(
            row["proposal_json"]
        )
        batch = MutationBatch(
            idempotencyKey=request.idempotencyKey,
            operations=proposal.operations,
        )
        result = self._mutation_executor.execute_proposal(
            connection, batch, proposal_id
        )
        now = format_utc(self._clock())
        self._repository.mark_applied(
            connection, proposal_id=proposal_id, now=now
        )
        applied = self._repository.get(connection, proposal_id)
        assert applied is not None
        return ProposalConfirmResult(
            proposal=self._view(applied), mutation=result
        )
    def _mark_failed(
        self,
        proposal_id: str,
        external_session_id: str,
        error: MutationError,
    ) -> None:
        try:
            with self._database.transaction() as connection:
                row = self._owned(
                    self._repository.get(connection, proposal_id),
                    external_session_id,
                )
                if row["status"] != ProposalStatus.PENDING.value:
                    return
                now = format_utc(self._clock())
                self._repository.mark_terminal(
                    connection,
                    proposal_id=proposal_id,
                    status=ProposalStatus.FAILED.value,
                    now=now,
                )
                self._repository.audit_transition(
                    connection,
                    event_id=self._id_factory(),
                    action="proposal.failed",
                    proposal_id=proposal_id,
                    result_json=f'{{"code":"{error.code.value}"}}',
                    now=now,
                )
        except (MutationError, sqlite3.Error, ValueError):
            return
    def _applied_result(
        self, connection: sqlite3.Connection, row: sqlite3.Row
    ) -> ProposalConfirmResult:
        raw_result = self._repository.applied_result(
            connection, row["id"]
        )
        if raw_result is None:
            raise MutationError("persistence_failed")
        return ProposalConfirmResult(
            proposal=self._view(row),
            mutation=MutationResult.model_validate_json(raw_result),
        )
    @staticmethod
    def _owned(
        row: sqlite3.Row | None, external_session_id: str
    ) -> sqlite3.Row:
        if (
            row is None
            or row["external_session_id"] != external_session_id
        ):
            raise MutationError("target_missing")
        return row
