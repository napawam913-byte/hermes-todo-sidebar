from dataclasses import dataclass
from datetime import date, datetime, timezone

import pytest
from pydantic import BaseModel, ValidationError

from plan_api.contracts.content import ContentDocument
from plan_api.contracts.tasks import TaskDraft, TaskEntryDraft


@dataclass
class _DataclassValue:
    value: int


class _ModelValue(BaseModel):
    value: int


@pytest.mark.parametrize(
    ("field", "value"),
    [("kind", "weekly"), ("status", "deleted"), ("generation_mode", "dynamic")],
)
def test_task_draft_rejects_unknown_enums(field: str, value: str) -> None:
    payload = _task_payload(_content_payload("Task"))
    payload[field] = value

    with pytest.raises(ValidationError):
        TaskDraft.model_validate(payload)


def test_entry_draft_rejects_unknown_status_and_source() -> None:
    payload = _entry_payload(_content_payload("Entry"))

    for field, value in [("status", "open"), ("source", "system")]:
        with pytest.raises(ValidationError):
            TaskEntryDraft.model_validate({**payload, field: value})


@pytest.mark.parametrize("draft_type", [TaskDraft, TaskEntryDraft])
@pytest.mark.parametrize("as_document", [False, True])
def test_drafts_recheck_content_array_bound(draft_type, as_document: bool) -> None:
    payload = _content_payload("Too many items", list(range(201)))
    content = ContentDocument.model_validate(payload) if as_document else payload

    with pytest.raises(ValidationError, match="array_too_large"):
        draft_type.model_validate(_draft_payload(draft_type, content))


@pytest.mark.parametrize(
    ("draft_type", "value", "as_document", "error"),
    [
        (TaskDraft, {"nested": {"nested": {"nested": {}}}}, True, "content_too_deep"),
        (TaskEntryDraft, "x" * 65536, False, "content_too_large"),
    ],
    ids=["task-document-too-deep", "entry-payload-too-large"],
)
def test_drafts_recheck_content_depth_and_size(
    draft_type, value: object, as_document: bool, error: str
) -> None:
    payload = _content_payload("Invalid content", value)
    content = ContentDocument.model_validate(payload) if as_document else payload

    with pytest.raises(ValidationError, match=error):
        draft_type.model_validate(_draft_payload(draft_type, content))


@pytest.mark.parametrize("draft_type", [TaskDraft, TaskEntryDraft])
def test_drafts_reject_pre_mutated_datetime(draft_type) -> None:
    content = ContentDocument.model_validate(_content_payload("Mutated", "safe"))
    content.sections[0].fields[0].value = datetime(
        2026, 7, 23, tzinfo=timezone.utc
    )

    with pytest.raises(ValidationError, match="content_not_json"):
        draft_type.model_validate(_draft_payload(draft_type, content))


@pytest.mark.parametrize("draft_type", [TaskDraft, TaskEntryDraft])
@pytest.mark.parametrize("value", [_DataclassValue(1), _ModelValue(value=1)])
def test_drafts_reject_pre_mutated_custom_object(draft_type, value) -> None:
    content = ContentDocument.model_validate(_content_payload("Mutated", "safe"))
    content.sections[0].fields[0].value = value

    with pytest.raises(ValidationError, match="content_not_json"):
        draft_type.model_validate(_draft_payload(draft_type, content))


def _draft_payload(draft_type, content: object) -> dict[str, object]:
    return (
        _task_payload(content)
        if draft_type is TaskDraft
        else _entry_payload(content)
    )


def _task_payload(content: object) -> dict[str, object]:
    return {
        "kind": "cycle",
        "generation_mode": "fixed",
        "content": content,
    }


def _entry_payload(content: object) -> dict[str, object]:
    return {"scheduled_date": date(2026, 7, 23), "content": content}


def _content_payload(
    title: str, value: object | None = None
) -> dict[str, object]:
    sections: list[object] = []
    if value is not None:
        sections.append({
            "id": "main",
            "label": "Main",
            "layout": "fields",
            "fields": [{
                "key": "detail",
                "label": "Detail",
                "type": "value",
                "value": value,
            }],
        })
    return {
        "schemaVersion": 1,
        "kind": "test.task",
        "title": title,
        "summary": "Fixed test content.",
        "locale": "en-US",
        "sections": sections,
    }
