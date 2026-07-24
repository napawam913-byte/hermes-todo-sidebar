from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query

from ..contracts.tasks import TaskView, TodayView
from ..db.database import Database
from ..repositories.task_repository import TaskRepository
from .dependencies import (
    DatabaseDep,
    QueryServiceDep,
    ReadRole,
    RepositoryDep,
    RollingGeneratorDep,
)
from .errors import ApiError


router = APIRouter(prefix="/v1")


@router.get("/snapshot")
def snapshot(
    _role: ReadRole,
    database: DatabaseDep,
    repository: RepositoryDep,
) -> dict[str, object]:
    revision, tasks = _read_tasks(database, repository)
    return {"serverRevision": revision, "tasks": tasks}


@router.get("/today")
def today(
    target_date: Annotated[date, Query(alias="date")],
    _role: ReadRole,
    generator: RollingGeneratorDep,
    query_service: QueryServiceDep,
) -> TodayView:
    generator.ensure_window(target_date)
    return query_service.today(target_date)


@router.get("/tasks")
def tasks(
    _role: ReadRole,
    database: DatabaseDep,
    repository: RepositoryDep,
) -> dict[str, object]:
    _, task_items = _read_tasks(database, repository)
    return {"tasks": task_items}


@router.get("/tasks/{task_id}")
def task_detail(
    task_id: str,
    _role: ReadRole,
    database: DatabaseDep,
    repository: RepositoryDep,
) -> TaskView:
    with database.connect() as connection:
        task = repository.get_task(connection, task_id)
    if task is None:
        raise ApiError(404, "target_missing")
    return task


def _read_tasks(
    database: Database, repository: TaskRepository
) -> tuple[int, tuple[TaskView, ...]]:
    with database.connect() as connection:
        connection.execute("BEGIN")
        try:
            revision_row = connection.execute(
                "SELECT server_revision FROM app_meta WHERE id = 1"
            ).fetchone()
            id_rows = connection.execute(
                "SELECT id FROM tasks ORDER BY created_at, id"
            ).fetchall()
            task_items = tuple(
                repository.get_task(connection, str(row["id"]))
                for row in id_rows
            )
            connection.commit()
        except BaseException:
            connection.rollback()
            raise
    tasks = tuple(task for task in task_items if task is not None)
    return int(revision_row["server_revision"]), tasks
