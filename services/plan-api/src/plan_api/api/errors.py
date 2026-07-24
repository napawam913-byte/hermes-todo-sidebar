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
    app.add_exception_handler(Exception, _unexpected_error)


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


async def _unexpected_error(
    request: Request, _error: Exception
) -> JSONResponse:
    return error_response(request, 500, "internal_error")


def error_response(
    request: Request,
    status_code: int,
    code: str,
    message: str | None = None,
    extra: dict[str, object] | None = None,
) -> JSONResponse:
    return _response(request, status_code, code, message, extra)


def _response(
    request: Request,
    status_code: int,
    code: str,
    message: str | None = None,
    extra: dict[str, object] | None = None,
) -> JSONResponse:
    content = {
        "code": code,
        "message": message or code,
        "requestId": _request_id(request),
    }
    if extra is not None:
        content.update(extra)
    return JSONResponse(
        status_code=status_code,
        content=content,
    )


def _request_id(request: Request) -> str:
    request_id = getattr(request.state, "request_id", None)
    if request_id is None:
        request_id = uuid4().hex
        request.state.request_id = request_id
    return request_id
