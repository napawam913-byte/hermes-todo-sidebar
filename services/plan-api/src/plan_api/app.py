from fastapi import FastAPI

from plan_api.settings import Settings


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings.from_env()
    app = FastAPI(title="Hermes Todo Plan API", version="1")

    @app.get("/v1/health")
    def health() -> dict[str, object]:
        return {"status": "ok", "service": "plan-api", "apiVersion": 1}

    return app
