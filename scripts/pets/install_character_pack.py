"""Validate and install an explicitly approved CharacterPack candidate."""

from __future__ import annotations

import argparse
import json
import re
import shutil
from pathlib import Path

from PIL import Image

from character_pack_v3 import (
    ATLAS_HEIGHT,
    ATLAS_WIDTH,
    CELL_HEIGHT,
    CELL_WIDTH,
    ROW_COUNT,
    validate_manifest,
)

REQUIRED_FILES = ("character.json", "atlas.webp", "thumbnail.webp")
REQUIRED_CLIPS = (
    "idle", "awaken", "dragging", "thinking", "working", "waiting",
    "reminding", "complete", "error", "sleeping",
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="安装已人工验收的桌宠角色包")
    parser.add_argument("--candidate", required=True, type=Path)
    parser.add_argument("--app-root", required=True, type=Path)
    parser.add_argument("--approved", action="store_true", help="确认联系表和动图已人工验收")
    return parser.parse_args()


def validate(candidate: Path) -> dict[str, object]:
    for name in REQUIRED_FILES:
        if not (candidate / name).is_file():
            raise ValueError(f"候选角色包缺少 {name}")
    manifest = validate_manifest(
        json.loads((candidate / "character.json").read_text(encoding="utf-8"))
    )
    character_id = manifest.get("id")
    if not isinstance(character_id, str) or not re.fullmatch(r"[a-z0-9][a-z0-9-]*", character_id):
        raise ValueError("角色 ID 无效")
    atlas = manifest.get("atlas", {})
    expected = {"columns": 6, "rows": 14, "cellWidth": 192, "cellHeight": 208,
                "renderWidth": 88, "renderHeight": 96}
    if atlas != expected:
        raise ValueError("图集尺寸合同无效")
    clips = manifest.get("clips", {})
    if not all(name in clips for name in REQUIRED_CLIPS):
        raise ValueError("角色动作不完整")
    if set(clips.get("dragging", {})) != {"up", "down", "left", "right"}:
        raise ValueError("四向拖动动作不完整")
    with Image.open(candidate / "atlas.webp") as image:
        if image.size != (ATLAS_WIDTH, ATLAS_HEIGHT) or "A" not in image.getbands():
            raise ValueError("图集必须为 1152×2912 透明图像")
        _validate_atlas_pixels(image.convert("RGBA"))
    with Image.open(candidate / "thumbnail.webp") as image:
        if image.size != (88, 96):
            raise ValueError("缩略图必须为 88×96")
    return manifest


def install_candidate(candidate: Path, app_root: Path, approved: bool) -> Path:
    """仅安装已验证且显式批准的新角色包，不覆盖已安装目录。"""
    if not approved:
        raise PermissionError("安装前必须人工检查联系表和十四个动作预览")
    manifest = validate(candidate)
    parent = app_root.resolve() / "apps/desktop/src/renderer/assets/characters"
    target = parent / str(manifest["id"])
    if target.exists():
        raise FileExistsError(f"角色已安装，拒绝覆盖：{target}")
    staging = parent / f".{manifest['id']}-installing"
    if staging.exists():
        raise FileExistsError(f"存在未完成安装目录：{staging}")
    staging.mkdir(parents=True)
    try:
        for name in REQUIRED_FILES:
            shutil.copy2(candidate / name, staging / name)
        staging.rename(target)
    except Exception:
        shutil.rmtree(staging, ignore_errors=True)
        raise
    return target


def _validate_atlas_pixels(atlas: Image.Image) -> None:
    alpha = atlas.getchannel("A")
    minimum, maximum = alpha.getextrema()
    if minimum != 0 or maximum == 0:
        raise ValueError("图集必须同时包含透明背景和非空角色像素")
    for row in range(ROW_COUNT):
        for column in range(6):
            frame = alpha.crop((
                column * CELL_WIDTH,
                row * CELL_HEIGHT,
                (column + 1) * CELL_WIDTH,
                (row + 1) * CELL_HEIGHT,
            ))
            if frame.getbbox() is None:
                raise ValueError(f"图集包含空帧：第 {row + 1} 行第 {column + 1} 帧")


def main() -> None:
    args = parse_args()
    try:
        print(install_candidate(args.candidate, args.app_root, args.approved))
    except PermissionError as error:
        raise SystemExit(str(error)) from error


if __name__ == "__main__":
    main()
