"""模块用途：校验 Hermes 提案作用域并管理待确认提案生命周期。"""

from collections.abc import Callable
from datetime import datetime, timedelta, timezone
import sqlite3
from uuid import uuid4

from ..contracts.mutations import MutationError
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
from .proposal_lifecycle import ProposalLifecycle
from .proposal_scope import ProposalScopeValidator


class ProposalService:
    def __init__(
        self,
        database: Database,
        *,
        mutation_executor: MutationExecutor | None = None,
        clock: Callable[[], datetime] | None = None,
        id_factory: Callable[[], str] | None = None,
        ttl: timedelta = timedelta(minutes=30),
    ) -> None:
        self._database = database
        self._clock = clock or (lambda: datetime.now(timezone.utc))
        self._id_factory = id_factory or (lambda: uuid4().hex)
        self._ttl = ttl
        self._repository = ProposalRepository()
        self._scope = ProposalScopeValidator()
        self._mutation_executor = mutation_executor or MutationExecutor(
            database, clock=self._clock, id_factory=self._id_factory
        )
        self._lifecycle = ProposalLifecycle(
            database,
            self._repository,
            self._mutation_executor,
            self._view,
            self._clock,
            self._id_factory,
        )

    def create(self, request: ProposalCreateRequest) -> ProposalView:
        proposal_json = request.model_dump_json(exclude_unset=True)
        now_value = self._clock()
        now = format_utc(now_value)
        expires_at = format_utc(now_value + self._ttl)
        try:
            with self._database.transaction() as connection:
                existing = self._repository.find_by_idempotency(
                    connection, request.idempotencyKey
                )
                if existing is not None:
                    if existing["proposal_json"] != proposal_json:
                        raise MutationError("validation_failed")
                    return self._view(existing)
                self._scope.validate(connection, request)
                session_id = self._repository.session_id(
                    connection,
                    internal_id=self._id_factory(),
                    external_id=request.externalSessionId,
                    now=now,
                )
                proposal_id = self._id_factory()
                self._repository.insert(
                    connection,
                    proposal_id=proposal_id,
                    session_id=session_id,
                    proposal_json=proposal_json,
                    expires_at=expires_at,
                    target_task_id=request.targetTaskId,
                    target_version=request.targetVersion,
                    idempotency_key=request.idempotencyKey,
                    now=now,
                )
                row = self._repository.get(connection, proposal_id)
                assert row is not None
                view = self._view(row)
                self._repository.audit_created(
                    connection,
                    event_id=self._id_factory(),
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
        return self._lifecycle.confirm(proposal_id, request)

    def get(
        self, proposal_id: str, external_session_id: str
    ) -> ProposalView:
        return self._lifecycle.get(proposal_id, external_session_id)

    def cancel(
        self,
        proposal_id: str,
        request: ProposalTransitionRequest,
    ) -> ProposalView:
        return self._lifecycle.cancel(proposal_id, request)

    @staticmethod
    def _view(row: sqlite3.Row) -> ProposalView:
        request = ProposalCreateRequest.model_validate_json(
            row["proposal_json"]
        )
        return ProposalView(
            id=row["id"],
            externalSessionId=row["external_session_id"],
            summary=request.summary,
            operations=request.operations,
            status=ProposalStatus(row["status"]),
            expiresAt=parse_utc(row["expires_at"]),
            targetTaskId=row["target_task_id"],
            targetVersion=row["target_version"],
            createdAt=parse_utc(row["created_at"]),
            updatedAt=parse_utc(row["updated_at"]),
            appliedAt=(
                None
                if row["applied_at"] is None
                else parse_utc(row["applied_at"])
            ),
        )
