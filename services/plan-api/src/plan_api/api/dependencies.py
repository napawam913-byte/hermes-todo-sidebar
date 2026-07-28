from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from ..db.database import Database
from ..repositories.task_repository import TaskRepository
from ..services.mutation_executor import MutationExecutor
from ..services.proposal_service import ProposalService
from ..services.query_service import QueryService
from ..services.rolling_generator import RollingGenerator
from ..settings import Settings
from .auth import TokenRole, resolve_role
from .errors import ApiError


bearer = HTTPBearer(auto_error=False)


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


def authenticated_role(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(bearer)
    ],
    settings: Annotated[Settings, Depends(get_settings)],
) -> TokenRole:
    return resolve_role(credentials, settings)


def desktop_role(
    role: Annotated[TokenRole, Depends(authenticated_role)],
) -> TokenRole:
    if role is not TokenRole.DESKTOP:
        raise ApiError(403, "permission_denied")
    return role


def hermes_role(
    role: Annotated[TokenRole, Depends(authenticated_role)],
) -> TokenRole:
    if role is not TokenRole.HERMES:
        raise ApiError(403, "permission_denied")
    return role


def get_database(request: Request) -> Database:
    return request.app.state.database


def get_repository(request: Request) -> TaskRepository:
    return request.app.state.task_repository


def get_query_service(request: Request) -> QueryService:
    return request.app.state.query_service


def get_rolling_generator(request: Request) -> RollingGenerator:
    return request.app.state.rolling_generator


def get_mutation_executor(request: Request) -> MutationExecutor:
    return request.app.state.mutation_executor


def get_proposal_service(request: Request) -> ProposalService:
    return request.app.state.proposal_service


ReadRole = Annotated[TokenRole, Depends(authenticated_role)]
DesktopRole = Annotated[TokenRole, Depends(desktop_role)]
HermesRole = Annotated[TokenRole, Depends(hermes_role)]
DatabaseDep = Annotated[Database, Depends(get_database)]
RepositoryDep = Annotated[TaskRepository, Depends(get_repository)]
QueryServiceDep = Annotated[QueryService, Depends(get_query_service)]
RollingGeneratorDep = Annotated[
    RollingGenerator, Depends(get_rolling_generator)
]
MutationExecutorDep = Annotated[
    MutationExecutor, Depends(get_mutation_executor)
]
ProposalServiceDep = Annotated[
    ProposalService, Depends(get_proposal_service)
]
