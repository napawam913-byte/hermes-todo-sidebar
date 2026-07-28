"""模块用途：在单个数据库事务中鉴权、分派并审计 mutation 批次。"""

from collections.abc import Callable
from datetime import datetime, timezone
import sqlite3
from uuid import uuid4

from ..contracts.mutations import (
    Actor,
    EntryComplete,
    EntryCreate,
    EntryDelete,
    EntryReopen,
    EntrySkip,
    EntryUpdate,
    MutationBatch,
    MutationError,
    MutationOperation,
    MutationResult,
    TaskCreate,
    TaskDelete,
    TaskSetStatus,
    TaskUpdate,
)
from ..db.database import Database
from ..repositories.task_repository import TaskRepository
from .entry_mutations import EntryMutations
from .mutation_batch_guards import validate_batch_invariants
from .mutation_revision_guard import require_expected_revision
from .mutation_persistence import MutationPersistence
from .rolling_generator import RollingGenerator
from .rule_adjustment import RuleAdjustmentService
from .task_mutations import ChangedIds, TaskMutations


class MutationExecutor:
    def __init__(
        self,
        database: Database,
        *,
        clock: Callable[[], datetime] | None = None,
        id_factory: Callable[[], str] | None = None,
    ) -> None:
        self._database = database
        self._clock = clock or (lambda: datetime.now(timezone.utc))
        self._id_factory = id_factory or (lambda: uuid4().hex)
        repository = TaskRepository(
            clock=self._clock, id_factory=self._id_factory
        )
        generator = RollingGenerator(
            database,
            repository,
            clock=self._clock,
            id_factory=self._id_factory,
        )
        adjustment = RuleAdjustmentService(
            repository, generator, clock=self._clock
        )
        self._tasks = TaskMutations(
            repository, adjustment, clock=self._clock
        )
        self._entries = EntryMutations(
            clock=self._clock, id_factory=self._id_factory
        )
        self._persistence = MutationPersistence(
            clock=self._clock, id_factory=self._id_factory
        )

    def execute(
        self, batch: MutationBatch, actor: Actor | str
    ) -> MutationResult:
        try:
            resolved_actor = Actor(actor)
        except ValueError:
            raise MutationError("permission_denied") from None
        if resolved_actor is not Actor.DESKTOP:
            raise MutationError("permission_denied")
        try:
            with self._database.transaction() as connection:
                return self._execute_in_transaction(
                    connection, batch, resolved_actor, proposal_id=None
                )
        except MutationError:
            raise
        except ValueError as error:
            raise MutationError(
                "validation_failed", message=str(error)
            ) from error
        except sqlite3.IntegrityError as error:
            raise MutationError("persistence_failed") from error
        except Exception as error:
            raise MutationError("persistence_failed") from error

    def execute_proposal(
        self,
        connection: sqlite3.Connection,
        batch: MutationBatch,
        proposal_id: str,
    ) -> MutationResult:
        try:
            return self._execute_in_transaction(
                connection, batch, Actor.HERMES, proposal_id=proposal_id
            )
        except MutationError:
            raise
        except ValueError as error:
            raise MutationError(
                "validation_failed", message=str(error)
            ) from error
        except Exception as error:
            raise MutationError("persistence_failed") from error

    def _execute_in_transaction(
        self,
        connection: sqlite3.Connection,
        batch: MutationBatch,
        actor: Actor,
        *,
        proposal_id: str | None,
    ) -> MutationResult:
        request_hash = batch.request_hash()
        validate_batch_invariants(batch)
        cached = self._persistence.cached(
            connection, batch.idempotencyKey, request_hash
        )
        if cached is not None:
            return cached
        require_expected_revision(
            connection, batch.expectedServerRevision
        )
        changed_tasks: set[str] = set()
        changed_entries: set[str] = set()
        for operation in batch.operations:
            task_ids, entry_ids = self._dispatch(connection, operation)
            changed_tasks.update(task_ids)
            changed_entries.update(entry_ids)
        result = MutationResult(
            serverRevision=self._persistence.bump_revision(connection),
            changedTaskIds=sorted(changed_tasks),
            changedEntryIds=sorted(changed_entries),
        )
        self._persistence.write_audit(
            connection, actor, result, proposal_id
        )
        self._persistence.save_idempotency(
            connection, batch.idempotencyKey, request_hash, result
        )
        return result

    def _dispatch(
        self,
        connection: sqlite3.Connection,
        operation: MutationOperation,
    ) -> ChangedIds:
        if isinstance(operation, TaskCreate):
            return self._tasks.create(connection, operation)
        if isinstance(operation, TaskUpdate):
            return self._tasks.update(connection, operation)
        if isinstance(operation, TaskSetStatus):
            return self._tasks.set_status(connection, operation)
        if isinstance(operation, TaskDelete):
            return self._tasks.delete(connection, operation)
        if isinstance(operation, EntryCreate):
            return self._entries.create(connection, operation)
        if isinstance(operation, EntryUpdate):
            return self._entries.update(connection, operation)
        if isinstance(operation, EntryComplete):
            return self._entries.complete(connection, operation)
        if isinstance(operation, EntryReopen):
            return self._entries.reopen(connection, operation)
        if isinstance(operation, EntrySkip):
            return self._entries.skip(connection, operation)
        if isinstance(operation, EntryDelete):
            return self._entries.delete(connection, operation)
        raise MutationError("validation_failed")
