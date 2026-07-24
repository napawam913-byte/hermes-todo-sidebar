from fastapi import APIRouter

from ..contracts.mutations import (
    MutationBatch,
    MutationError,
    MutationResult,
)
from .dependencies import DesktopRole, MutationExecutorDep
from .errors import ApiError


router = APIRouter(prefix="/v1")

ERROR_STATUS = {
    "target_missing": 404,
    "version_conflict": 409,
    "validation_failed": 422,
    "permission_denied": 403,
    "persistence_failed": 500,
}


@router.post("/mutations")
def execute_mutations(
    batch: MutationBatch,
    _role: DesktopRole,
    executor: MutationExecutorDep,
) -> MutationResult:
    try:
        return executor.execute(batch, actor="desktop")
    except MutationError as error:
        code = error.code.value
        raise ApiError(ERROR_STATUS[code], code) from error
