"""角色工厂 V3 的固定尺寸、动作行和清单合同。"""

from __future__ import annotations

import re
from typing import Any

FRAME_COUNT = 6
ROW_COUNT = 14
CELL_WIDTH, CELL_HEIGHT = 192, 208
ATLAS_WIDTH, ATLAS_HEIGHT = 1152, 2912
RENDER_WIDTH, RENDER_HEIGHT = 88, 96

STATE_SPECS = (
    ("idle-base", 0, 4800, True),
    ("idle-blink", 1, 360, False),
    ("awaken", 2, 840, False),
    ("drag-down", 3, 600, True),
    ("drag-up", 4, 600, True),
    ("drag-right", 5, 600, True),
    ("drag-left", 6, 600, True),
    ("thinking", 7, 2800, True),
    ("working", 8, 1400, True),
    ("waiting", 9, 3200, True),
    ("reminding", 10, 800, False),
    ("complete", 11, 900, False),
    ("error", 12, 900, False),
    ("sleeping", 13, 6000, True),
)
STATE_NAMES = tuple(spec[0] for spec in STATE_SPECS)


def build_manifest(character_id: str, display_name: str, version: str = "3.0.0") -> dict[str, Any]:
    """创建只含身份、图集规格和动作行映射的 V3 清单。"""
    return {
        "schemaVersion": 3,
        "id": character_id,
        "displayName": display_name,
        "version": version,
        "atlas": {
            "columns": FRAME_COUNT,
            "rows": ROW_COUNT,
            "cellWidth": CELL_WIDTH,
            "cellHeight": CELL_HEIGHT,
            "renderWidth": RENDER_WIDTH,
            "renderHeight": RENDER_HEIGHT,
        },
        "clips": {
            "idle": {"base": {"row": 0}, "blink": {"row": 1}},
            "awaken": {"row": 2},
            "dragging": {
                "down": {"row": 3}, "up": {"row": 4},
                "right": {"row": 5}, "left": {"row": 6},
            },
            "thinking": {"row": 7},
            "working": {"row": 8},
            "waiting": {"row": 9},
            "reminding": {"row": 10},
            "complete": {"row": 11},
            "error": {"row": 12},
            "sleeping": {"row": 13},
        },
    }


def validate_manifest(manifest: object) -> dict[str, Any]:
    """严格拒绝未知字段和错误行号。"""
    value = _record(manifest, "角色包")
    _exact(value, {"schemaVersion", "id", "displayName", "version", "atlas", "clips"}, "角色包")
    if value.get("schemaVersion") != 3:
        raise ValueError("角色包 schemaVersion 必须为 3")
    if not isinstance(value.get("id"), str) or not re.fullmatch(r"[a-z0-9][a-z0-9-]*", value["id"]):
        raise ValueError("角色 ID 无效")
    if not isinstance(value.get("displayName"), str) or not value["displayName"].strip():
        raise ValueError("角色名称无效")
    version = value.get("version")
    if not isinstance(version, str) or not version.strip():
        raise ValueError("角色版本无效")
    expected = build_manifest(value["id"], value["displayName"], version)
    if value.get("atlas") != expected["atlas"]:
        raise ValueError("图集尺寸合同无效")
    if value.get("clips") != expected["clips"]:
        raise ValueError("十四行动作映射无效或包含未知字段")
    return value


def _record(value: object, label: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError(f"{label}必须是对象")
    return value


def _exact(value: dict[str, Any], keys: set[str], label: str) -> None:
    if set(value) != keys:
        raise ValueError(f"{label}包含未知字段")
