import sqlite3

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from .dependencies import DatabaseDep


router = APIRouter(prefix="/v1")


@router.get("/health", response_model=None)
def health(database: DatabaseDep) -> dict[str, object] | JSONResponse:
    try:
        with database.connect() as connection:
            row = connection.execute(
                "SELECT server_revision FROM app_meta WHERE id = 1"
            ).fetchone()
        revision = int(row["server_revision"])
    except (sqlite3.Error, TypeError):
        return JSONResponse(
            status_code=503,
            content={
                "status": "degraded",
                "service": "plan-api",
                "apiVersion": 1,
                "database": {"status": "error"},
                "serverRevision": None,
            },
        )
    return {
        "status": "ok",
        "service": "plan-api",
        "apiVersion": 1,
        "database": {"status": "ok"},
        "serverRevision": revision,
    }
