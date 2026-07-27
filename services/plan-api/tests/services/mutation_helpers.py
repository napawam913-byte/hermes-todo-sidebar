from collections.abc import Iterator
from datetime import datetime, timezone

from plan_api.contracts.mutations import MutationBatch
from plan_api.db.database import Database
from plan_api.db.migrations import apply_migrations
from plan_api.services.mutation_executor import MutationExecutor


NOW = datetime(2026, 7, 23, 1, 2, 3, tzinfo=timezone.utc)


def content(title: str) -> dict[str, object]:
    return {
        "schemaVersion": 1,
        "kind": "test.task",
        "title": title,
        "summary": "Mutation test content.",
        "locale": "en-US",
        "sections": [],
    }


def entry_draft(title: str = "Entry") -> dict[str, object]:
    return {
        "scheduled_date": "2026-07-24",
        "content": content(title),
        "source": "manual",
    }


def task_draft(
    title: str = "Task",
    *,
    kind: str = "cycle",
    entries: list[dict[str, object]] | None = None,
) -> dict[str, object]:
    return {
        "kind": kind,
        "generation_mode": "fixed",
        "content": content(title),
        "entries": entries if entries is not None else [],
    }


def operation(kind: str, **values: object) -> dict[str, object]:
    return {"type": kind, **values}


def batch(
    key: str,
    *operations: dict[str, object],
    expected_server_revision: int | None = None,
) -> MutationBatch:
    payload: dict[str, object] = {
        "idempotencyKey": key,
        "operations": operations,
    }
    if expected_server_revision is not None:
        payload["expectedServerRevision"] = expected_server_revision
    return MutationBatch.model_validate(
        payload
    )


def setup_executor(tmp_path) -> tuple[Database, MutationExecutor]:
    database = Database(tmp_path / "plan.db")
    apply_migrations(database)
    ids = iter(f"id-{number}" for number in range(1, 100))
    executor = MutationExecutor(
        database,
        clock=lambda: NOW,
        id_factory=ids.__next__,
    )
    return database, executor


def create_cycle(executor: MutationExecutor, key: str = "create"):
    result = executor.execute(
        batch(
            key,
            operation(
                "task.create",
                draft=task_draft(entries=[entry_draft()]),
            ),
        ),
        actor="desktop",
    )
    return result.changedTaskIds[0], result.changedEntryIds[0]


def rows(database: Database, table: str) -> list[dict[str, object]]:
    with database.connect() as connection:
        return [dict(row) for row in connection.execute(f"SELECT * FROM {table}")]


def ids() -> Iterator[str]:
    for number in range(1, 100):
        yield f"id-{number}"
