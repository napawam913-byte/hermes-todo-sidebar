from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class ApiError(Exception):
    def __init__(
        self, status_code: int, code: str, message: str | None = None
    ) -> None:
        self.status_code = status_code
        self.code = code
        self.message = message or code
        super().__init__(self.message)


def install_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(ApiError, _api_error)
    app.add_exception_handler(RequestValidationError, _validation_error)
    app.add_exception_handler(StarletteHTTPException, _http_error)


async def _api_error(request: Request, error: ApiError) -> JSONResponse:
    return _response(
        request, error.status_code, error.code, error.message
    )


async def _validation_error(
    request: Request, _error: RequestValidationError
) -> JSONResponse:
    return _response(request, 422, "validation_failed")


async def _http_error(
    request: Request, error: StarletteHTTPException
) -> JSONResponse:
    code = error.detail if isinstance(error.detail, str) else "http_error"
    return _response(request, error.status_code, code)


def _response(
    request: Request,
    status_code: int,
    code: str,
    message: str | None = None,
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={
            "code": code,
            "message": message or code,
            "requestId": _request_id(request),
        },
    )


def _request_id(request: Request) -> str:
    request_id = getattr(request.state, "request_id", None)
    if request_id is None:
        request_id = uuid4().hex
        request.state.request_id = request_id
    return request_id
