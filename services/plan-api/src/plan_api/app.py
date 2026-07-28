from fastapi import FastAPI

from plan_api.api.auth import validate_token_settings
from plan_api.api.errors import install_error_handlers
from plan_api.api.routes_health import router as health_router
from plan_api.api.routes_mutations import router as mutations_router
from plan_api.api.routes_proposals import router as proposals_router
from plan_api.api.routes_tasks import router as tasks_router
from plan_api.db.database import Database
from plan_api.db.migrations import apply_migrations
from plan_api.repositories.task_repository import TaskRepository
from plan_api.services.mutation_executor import MutationExecutor
from plan_api.services.proposal_service import ProposalService
from plan_api.services.query_service import QueryService
from plan_api.services.rolling_generator import RollingGenerator
from plan_api.settings import Settings


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings.from_env()
    validate_token_settings(settings)
    database = Database(settings.database_path)
    apply_migrations(database)
    repository = TaskRepository()

    app = FastAPI(title="Hermes Todo Plan API", version="1")
    app.state.settings = settings
    app.state.database = database
    app.state.task_repository = repository
    mutation_executor = MutationExecutor(database)
    app.state.mutation_executor = mutation_executor
    app.state.proposal_service = ProposalService(
        database, mutation_executor=mutation_executor
    )
    app.state.rolling_generator = RollingGenerator(database, repository)
    app.state.query_service = QueryService(database, repository)

    install_error_handlers(app)
    app.include_router(health_router)
    app.include_router(tasks_router)
    app.include_router(mutations_router)
    app.include_router(proposals_router)
    return app
