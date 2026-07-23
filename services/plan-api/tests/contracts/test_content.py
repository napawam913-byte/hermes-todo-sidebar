import pytest

from plan_api.contracts.content import validate_content_payload


def content_payload(kind: str, value: object) -> dict[str, object]:
    return {
        "schemaVersion": 1,
        "kind": kind,
        "title": "Example plan",
        "summary": "A reusable content example.",
        "locale": "en-US",
        "sections": [
            {
                "id": "main",
                "label": "Main",
                "layout": "fields",
                "fields": [
                    {
                        "key": "detail",
                        "label": "Detail",
                        "type": "value",
                        "value": value,
                    }
                ],
            }
        ],
    }


@pytest.mark.parametrize(
    ("kind", "value"),
    [
        ("fitness.workout", {"reps": [15, 12, 12]}),
        ("learning.tutorial", {"section": "3.2"}),
    ],
)
def test_accepts_domain_specific_field_values(kind: str, value: object) -> None:
    document = validate_content_payload(content_payload(kind, value))

    assert document.kind == kind
    assert document.sections[0].fields[0].value == value


def test_rejects_unknown_top_level_field() -> None:
    payload = content_payload("fitness.workout", {"reps": [15, 12, 12]})
    payload["unexpected"] = "nope"

    with pytest.raises(ValueError):
        validate_content_payload(payload)


def test_rejects_value_larger_than_64_kb() -> None:
    with pytest.raises(ValueError, match="content_too_large"):
        validate_content_payload(content_payload("fitness.workout", "x" * 65536))


def test_rejects_nine_level_object() -> None:
    value: object = "leaf"
    for _ in range(9):
        value = {"nested": value}

    with pytest.raises(ValueError, match="content_too_deep"):
        validate_content_payload(content_payload("learning.tutorial", value))


def test_rejects_array_with_more_than_200_items() -> None:
    with pytest.raises(ValueError, match="array_too_large"):
        validate_content_payload(content_payload("fitness.workout", list(range(201))))
