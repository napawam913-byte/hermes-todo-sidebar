"""模块用途：封装 agent session、proposal 与提案审计的 SQLite 访问。"""

import sqlite3


class ProposalRepository:
    def find_by_idempotency(
        self, connection: sqlite3.Connection, key: str
    ) -> sqlite3.Row | None:
        return connection.execute(
            self._select() + " WHERE p.idempotency_key = ?",
            (key,),
        ).fetchone()

    def get(
        self, connection: sqlite3.Connection, proposal_id: str
    ) -> sqlite3.Row | None:
        return connection.execute(
            self._select() + " WHERE p.id = ?",
            (proposal_id,),
        ).fetchone()

    def session_id(
        self,
        connection: sqlite3.Connection,
        *,
        internal_id: str,
        external_id: str,
        now: str,
    ) -> str:
        row = connection.execute(
            """
            SELECT id FROM agent_sessions
            WHERE external_session_id = ?
            """,
            (external_id,),
        ).fetchone()
        if row is not None:
            connection.execute(
                "UPDATE agent_sessions SET updated_at = ? WHERE id = ?",
                (now, row["id"]),
            )
            return str(row["id"])
        connection.execute(
            """
            INSERT INTO agent_sessions (
                id, external_session_id, created_at, updated_at
            ) VALUES (?, ?, ?, ?)
            """,
            (internal_id, external_id, now, now),
        )
        return internal_id

    def insert(
        self,
        connection: sqlite3.Connection,
        *,
        proposal_id: str,
        session_id: str,
        proposal_json: str,
        expires_at: str,
        target_task_id: str | None,
        target_version: int | None,
        idempotency_key: str,
        now: str,
    ) -> None:
        connection.execute(
            """
            INSERT INTO agent_proposals (
                id, session_id, proposal_json, status, expires_at,
                target_task_id, target_version, idempotency_key,
                created_at, updated_at, applied_at
            ) VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, NULL)
            """,
            (
                proposal_id,
                session_id,
                proposal_json,
                expires_at,
                target_task_id,
                target_version,
                idempotency_key,
                now,
                now,
            ),
        )

    def mark_applied(
        self,
        connection: sqlite3.Connection,
        *,
        proposal_id: str,
        now: str,
    ) -> None:
        connection.execute(
            """
            UPDATE agent_proposals
            SET status = 'applied', updated_at = ?, applied_at = ?
            WHERE id = ? AND status = 'pending'
            """,
            (now, now, proposal_id),
        )

    def mark_cancelled(
        self,
        connection: sqlite3.Connection,
        *,
        proposal_id: str,
        now: str,
    ) -> None:
        connection.execute(
            """
            UPDATE agent_proposals
            SET status = 'cancelled', updated_at = ?
            WHERE id = ? AND status = 'pending'
            """,
            (now, proposal_id),
        )

    def mark_terminal(
        self,
        connection: sqlite3.Connection,
        *,
        proposal_id: str,
        status: str,
        now: str,
    ) -> None:
        if status not in {"expired", "failed"}:
            raise ValueError("invalid_proposal_terminal_status")
        connection.execute(
            """
            UPDATE agent_proposals
            SET status = ?, updated_at = ?
            WHERE id = ? AND status = 'pending'
            """,
            (status, now, proposal_id),
        )

    def applied_result(
        self, connection: sqlite3.Connection, proposal_id: str
    ) -> str | None:
        row = connection.execute(
            """
            SELECT result_json FROM audit_events
            WHERE proposal_id = ? AND action = 'mutation.batch'
            ORDER BY created_at DESC LIMIT 1
            """,
            (proposal_id,),
        ).fetchone()
        return None if row is None else str(row["result_json"])

    def audit_created(
        self,
        connection: sqlite3.Connection,
        *,
        event_id: str,
        proposal_id: str,
        result_json: str,
        now: str,
    ) -> None:
        connection.execute(
            """
            INSERT INTO audit_events (
                id, actor, action, target_type, target_id,
                proposal_id, result_json, created_at
            ) VALUES (?, 'hermes', 'proposal.created', 'proposal', ?, ?, ?, ?)
            """,
            (event_id, proposal_id, proposal_id, result_json, now),
        )

    def audit_transition(
        self,
        connection: sqlite3.Connection,
        *,
        event_id: str,
        action: str,
        proposal_id: str,
        result_json: str,
        now: str,
    ) -> None:
        connection.execute(
            """
            INSERT INTO audit_events (
                id, actor, action, target_type, target_id,
                proposal_id, result_json, created_at
            ) VALUES (?, 'hermes', ?, 'proposal', ?, ?, ?, ?)
            """,
            (
                event_id,
                action,
                proposal_id,
                proposal_id,
                result_json,
                now,
            ),
        )

    @staticmethod
    def _select() -> str:
        return """
            SELECT p.*, s.external_session_id
            FROM agent_proposals p
            JOIN agent_sessions s ON s.id = p.session_id
        """
