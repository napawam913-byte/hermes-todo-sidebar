import pytest

from plan_api.contracts.content import validate_content_payload


class CustomList(list):
    pass


class CustomDict(dict):
    pass


class LookalikeSection:
    id = "main"
    label = "Main"
    layout = "fields"
    fields = []
    items = []


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


def nested_containers(count: int) -> object:
    value: object = {}
    for _ in range(count - 1):
        value = {"nested": value}
    return value


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
    secret = "sensitive-" + "x" * 4096
    payload["unexpected"] = secret

    with pytest.raises(ValueError, match="^invalid_content$") as error:
        validate_content_payload(payload)

    assert secret not in str(error.value)
    assert secret not in repr(error.value.args)


def test_rejects_value_larger_than_64_kb() -> None:
    with pytest.raises(ValueError, match="content_too_large"):
        validate_content_payload(content_payload("fitness.workout", "x" * 65536))


def test_allows_exactly_eight_container_levels() -> None:
    document = validate_content_payload(
        content_payload("learning.tutorial", nested_containers(3))
    )

    assert document.kind == "learning.tutorial"


def test_rejects_nine_container_levels() -> None:
    with pytest.raises(ValueError, match="content_too_deep"):
        validate_content_payload(content_payload("learning.tutorial", nested_containers(4)))


def test_rejects_array_with_more_than_200_items() -> None:
    with pytest.raises(ValueError, match="array_too_large"):
        validate_content_payload(content_payload("fitness.workout", list(range(201))))


@pytest.mark.parametrize("value", [float("nan"), float("inf")])
def test_rejects_non_finite_numbers(value: float) -> None:
    with pytest.raises(ValueError, match="^content_not_json$"):
        validate_content_payload(content_payload("fitness.workout", value))


def test_rejects_non_string_json_key() -> None:
    with pytest.raises(ValueError, match="^content_not_json$"):
        validate_content_payload(content_payload("learning.tutorial", {1: "value"}))


@pytest.mark.parametrize("value", [CustomList([1]), CustomDict({"a": 1})])
def test_rejects_custom_json_container_subclasses(value: object) -> None:
    with pytest.raises(ValueError, match="^content_not_json$"):
        validate_content_payload(content_payload("learning.tutorial", value))


@pytest.mark.parametrize("field", ["sections", "fields", "items"])
def test_rejects_mutated_custom_structure_containers(field: str) -> None:
    document = validate_content_payload(content_payload("learning.tutorial", "safe"))
    section = document.sections[0]
    if field == "sections":
        document.sections = CustomList(document.sections)
    elif field == "fields":
        section.fields = CustomList(section.fields)
    else:
        section.items = CustomList(section.items)

    with pytest.raises(ValueError, match="^content_not_json$"):
        validate_content_payload(document)


def test_rejects_mutated_lookalike_structure_object() -> None:
    document = validate_content_payload(content_payload("learning.tutorial", "safe"))
    document.sections = [LookalikeSection()]

    with pytest.raises(ValueError, match="^content_not_json$"):
        validate_content_payload(document)
