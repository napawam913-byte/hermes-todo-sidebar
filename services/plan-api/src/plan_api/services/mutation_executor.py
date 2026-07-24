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
from ..contracts.tasks import format_utc
from ..db.database import Database
from ..repositories.task_repository import TaskRepository
from .entry_mutations import EntryMutations
from .mutation_batch_guards import validate_batch_invariants
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
            request_hash = batch.request_hash()
            validate_batch_invariants(batch)
            with self._database.transaction() as connection:
                cached = self._cached(
                    connection, batch.idempotencyKey, request_hash
                )
                if cached is not None:
                    return cached
                changed_tasks: set[str] = set()
                changed_entries: set[str] = set()
                for operation in batch.operations:
                    task_ids, entry_ids = self._dispatch(
                        connection, operation
                    )
                    changed_tasks.update(task_ids)
                    changed_entries.update(entry_ids)
                revision = self._bump_revision(connection)
                result = MutationResult(
                    serverRevision=revision,
                    changedTaskIds=sorted(changed_tasks),
                    changedEntryIds=sorted(changed_entries),
                )
                self._write_audit(connection, resolved_actor, result)
                self._save_idempotency(
                    connection, batch.idempotencyKey,
                    request_hash, result,
                )
                return result
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

    def _cached(
        self, connection: sqlite3.Connection, key: str, request_hash: str
    ) -> MutationResult | None:
        row = connection.execute(
            """
            SELECT request_hash, response_json
            FROM idempotency_records WHERE idempotency_key = ?
            """,
            (key,),
        ).fetchone()
        if row is None:
            return None
        if row["request_hash"] != request_hash:
            raise MutationError("validation_failed")
        return MutationResult.model_validate_json(row["response_json"])

    def _bump_revision(self, connection: sqlite3.Connection) -> int:
        connection.execute(
            """
            UPDATE app_meta
            SET server_revision = server_revision + 1, updated_at = ?
            WHERE id = 1
            """,
            (format_utc(self._clock()),),
        )
        row = connection.execute(
            "SELECT server_revision FROM app_meta WHERE id = 1"
        ).fetchone()
        return int(row["server_revision"])

    def _write_audit(
        self,
        connection: sqlite3.Connection,
        actor: Actor,
        result: MutationResult,
    ) -> None:
        connection.execute(
            """
            INSERT INTO audit_events (
                id, actor, action, target_type, target_id,
                proposal_id, result_json, created_at
            ) VALUES (?, ?, 'mutation.batch', NULL, NULL, NULL, ?, ?)
            """,
            (
                self._id_factory(),
                actor.value,
                result.model_dump_json(),
                format_utc(self._clock()),
            ),
        )

    def _save_idempotency(
        self,
        connection: sqlite3.Connection,
        key: str,
        request_hash: str,
        result: MutationResult,
    ) -> None:
        connection.execute(
            """
            INSERT INTO idempotency_records (
                idempotency_key, request_hash, response_json, created_at
            ) VALUES (?, ?, ?, ?)
            """,
            (
                key,
                request_hash,
                result.model_dump_json(),
                format_utc(self._clock()),
            ),
        )
