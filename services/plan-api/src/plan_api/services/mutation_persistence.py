"""模块用途：封装 mutation 修订号、幂等记录和审计持久化。"""

from collections.abc import Callable
from datetime import datetime
import sqlite3

from ..contracts.mutations import Actor, MutationError, MutationResult
from ..contracts.tasks import format_utc


class MutationPersistence:
    def __init__(
        self,
        *,
        clock: Callable[[], datetime],
        id_factory: Callable[[], str],
    ) -> None:
        self._clock = clock
        self._id_factory = id_factory

    def cached(
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

    def bump_revision(self, connection: sqlite3.Connection) -> int:
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

    def write_audit(
        self,
        connection: sqlite3.Connection,
        actor: Actor,
        result: MutationResult,
        proposal_id: str | None,
    ) -> None:
        connection.execute(
            """
            INSERT INTO audit_events (
                id, actor, action, target_type, target_id,
                proposal_id, result_json, created_at
            ) VALUES (?, ?, 'mutation.batch', NULL, NULL, ?, ?, ?)
            """,
            (
                self._id_factory(),
                actor.value,
                proposal_id,
                result.model_dump_json(),
                format_utc(self._clock()),
            ),
        )

    def save_idempotency(
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
