import json
from typing import Any


def enforce_json_bounds(
    payload: object,
    *,
    max_bytes: int,
    max_depth: int,
    max_array: int,
) -> None:
    """Reject JSON-like payloads that exceed shared content safety bounds."""
    _validate_json_value(payload, depth=0, max_depth=max_depth, max_array=max_array)
    try:
        encoded = json.dumps(payload, ensure_ascii=False, allow_nan=False).encode("utf-8")
    except (TypeError, ValueError) as error:
        raise ValueError("content_not_json") from error
    if len(encoded) > max_bytes:
        raise ValueError("content_too_large")


def _validate_json_value(
    value: object,
    *,
    depth: int,
    max_depth: int,
    max_array: int,
) -> None:
    if value is None or type(value) in (bool, int, float, str):
        return
    if type(value) is list:
        depth += 1
        if depth > max_depth:
            raise ValueError("content_too_deep")
        if len(value) > max_array:
            raise ValueError("array_too_large")
        for item in value:
            _validate_json_value(
                item,
                depth=depth,
                max_depth=max_depth,
                max_array=max_array,
            )
        return
    if type(value) is dict:
        depth += 1
        if depth > max_depth:
            raise ValueError("content_too_deep")
        for key, item in value.items():
            if type(key) is not str:
                raise ValueError("content_not_json")
            _validate_json_value(
                item,
                depth=depth,
                max_depth=max_depth,
                max_array=max_array,
            )
        return
    raise ValueError("content_not_json")
