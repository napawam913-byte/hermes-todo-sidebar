import json
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from ..validation.json_bounds import enforce_json_bounds


class ContentField(BaseModel):
    model_config = ConfigDict(extra="forbid")

    key: str = Field(pattern=r"^[A-Za-z][A-Za-z0-9_.-]*$", max_length=80)
    label: str = Field(min_length=1, max_length=120)
    type: str = Field(min_length=1, max_length=80)
    value: Any


class ContentItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=160)
    fields: list[ContentField] = Field(default_factory=list, max_length=100)


class ContentSection(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1, max_length=80)
    label: str = Field(min_length=1, max_length=120)
    layout: Literal["fields", "list", "markdown", "table"]
    fields: list[ContentField] = Field(default_factory=list, max_length=100)
    items: list[ContentItem] = Field(default_factory=list, max_length=100)


class ContentDocument(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schemaVersion: Literal[1]
    kind: str = Field(min_length=1, max_length=120)
    title: str = Field(min_length=1, max_length=200)
    summary: str = Field(min_length=1, max_length=500)
    locale: str = Field(min_length=2, max_length=20)
    sections: list[ContentSection] = Field(default_factory=list, max_length=100)


def validate_content_payload(payload: object) -> ContentDocument:
    if isinstance(payload, ContentDocument):
        payload = content_payload_snapshot(payload)
    enforce_json_bounds(payload, max_bytes=65536, max_depth=8, max_array=200)
    try:
        return ContentDocument.model_validate(payload)
    except ValidationError:
        raise ValueError("invalid_content") from None


def serialize_validated_content(content: ContentDocument) -> str:
    """Revalidate mutable nested content immediately before persistence."""
    validated = validate_content_payload(content)
    return json.dumps(
        validated.model_dump(mode="json", warnings="error"),
        ensure_ascii=False,
        allow_nan=False,
        separators=(",", ":"),
    )


def content_payload_snapshot(content: ContentDocument) -> dict[str, object]:
    """Copy contract fields while preserving each field's current raw value."""
    return {
        "schemaVersion": content.schemaVersion,
        "kind": content.kind,
        "title": content.title,
        "summary": content.summary,
        "locale": content.locale,
        "sections": [_section_snapshot(section) for section in content.sections],
    }


def _section_snapshot(section: ContentSection) -> dict[str, object]:
    return {
        "id": section.id,
        "label": section.label,
        "layout": section.layout,
        "fields": [_field_snapshot(field) for field in section.fields],
        "items": [_item_snapshot(item) for item in section.items],
    }


def _item_snapshot(item: ContentItem) -> dict[str, object]:
    return {
        "title": item.title,
        "fields": [_field_snapshot(field) for field in item.fields],
    }


def _field_snapshot(field: ContentField) -> dict[str, object]:
    return {
        "key": field.key,
        "label": field.label,
        "type": field.type,
        "value": field.value,
    }
