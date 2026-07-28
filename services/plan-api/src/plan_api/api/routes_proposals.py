"""模块用途：暴露 Hermes 受限提案 API，不开放桌面 mutation 权限。"""

from fastapi import APIRouter, status

from ..contracts.mutations import MutationError
from ..contracts.proposals import (
    ProposalConfirmResult,
    ProposalCreateRequest,
    ProposalTransitionRequest,
    ProposalView,
)
from .dependencies import HermesRole, ProposalServiceDep
from .errors import ApiError


router = APIRouter(prefix="/v1")


@router.post(
    "/proposals",
    response_model=ProposalView,
    status_code=status.HTTP_201_CREATED,
)
def create_proposal(
    request: ProposalCreateRequest,
    _role: HermesRole,
    service: ProposalServiceDep,
) -> ProposalView:
    try:
        return service.create(request)
    except MutationError as error:
        _raise_api_error(error)


@router.get(
    "/proposals/{proposal_id}",
    response_model=ProposalView,
)
def get_proposal(
    proposal_id: str,
    externalSessionId: str,
    _role: HermesRole,
    service: ProposalServiceDep,
) -> ProposalView:
    try:
        return service.get(proposal_id, externalSessionId)
    except MutationError as error:
        _raise_api_error(error)


@router.post(
    "/proposals/{proposal_id}/confirm",
    response_model=ProposalConfirmResult,
)
def confirm_proposal(
    proposal_id: str,
    request: ProposalTransitionRequest,
    _role: HermesRole,
    service: ProposalServiceDep,
) -> ProposalConfirmResult:
    try:
        return service.confirm(proposal_id, request)
    except MutationError as error:
        _raise_api_error(error)


@router.post(
    "/proposals/{proposal_id}/cancel",
    response_model=ProposalView,
)
def cancel_proposal(
    proposal_id: str,
    request: ProposalTransitionRequest,
    _role: HermesRole,
    service: ProposalServiceDep,
) -> ProposalView:
    try:
        return service.cancel(proposal_id, request)
    except MutationError as error:
        _raise_api_error(error)


def _raise_api_error(error: MutationError) -> None:
    code = error.code.value
    http_status = {
        "target_missing": 404,
        "permission_denied": 403,
        "version_conflict": 409,
        "proposal_expired": 409,
        "validation_failed": 422,
        "persistence_failed": 500,
    }[code]
    raise ApiError(http_status, code) from error
