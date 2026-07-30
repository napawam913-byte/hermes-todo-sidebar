"""构建 CharacterPack V3 十四行动作候选包，并暂留待删除的 V2 兼容入口。"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from statistics import median

from PIL import Image, ImageDraw, ImageOps

from background_cleanup import to_transparent_rgba
from character_pack_v3 import (
    ATLAS_HEIGHT,
    ATLAS_WIDTH,
    STATE_SPECS as V3_STATE_SPECS,
    build_manifest as build_v3_manifest,
)

FRAME_COUNT = 6
CELL_WIDTH, CELL_HEIGHT = 192, 208
RENDER_WIDTH, RENDER_HEIGHT = 88, 96
TARGET_HEIGHT, MAX_WIDTH, BASELINE = 184, 178, 199
# [待删除-2026-07-21] V2 七行动作表；V3 验收后连同旧构建入口删除。
STATES = (
    ("idle", 1290, True), ("awaken", 910, False),
    ("drag-down", 600, True), ("drag-up", 600, True),
    ("drag-right", 600, True), ("working", 880, True),
    ("complete", 940, False),
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="构建七行桌宠角色包候选文件")
    parser.add_argument("--id", required=True)
    parser.add_argument("--name", required=True)
    parser.add_argument("--strips-dir", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--mirror-left", action="store_true")
    return parser.parse_args()


def split_poses(image: Image.Image) -> list[Image.Image]:
    alpha = image.getchannel("A").point(lambda value: 255 if value > 16 else 0)
    projection, _ = alpha.getprojection()
    segments: list[tuple[int, int]] = []
    start: int | None = None
    for x, occupied in enumerate(projection):
        if occupied and start is None:
            start = x
        elif not occupied and start is not None:
            segments.append((start, x)); start = None
    if start is not None:
        segments.append((start, image.width))
    minimum = image.width / (FRAME_COUNT * 4)
    poses = [(left, right) for left, right in segments if right - left >= minimum]
    if len(poses) != FRAME_COUNT:
        bounds = [round(i * image.width / FRAME_COUNT) for i in range(FRAME_COUNT + 1)]
        poses = [(bounds[i], bounds[i + 1]) for i in range(FRAME_COUNT)]
    return [image.crop((left, 0, right, image.height)) for left, right in poses]


def normalize_row(source: Path) -> list[Image.Image]:
    if not source.is_file():
        raise ValueError(f"缺少透明动作条：{source.name}")
    with Image.open(source) as opened:
        image = to_transparent_rgba(opened)
    if image.getchannel("A").getextrema()[0] != 0:
        raise ValueError(f"动作条背景不透明：{source.name}")
    slots = split_poses(image)
    boxes = [slot.getchannel("A").getbbox() for slot in slots]
    if any(box is None for box in boxes):
        raise ValueError(f"动作条包含空帧：{source.name}")
    valid_boxes = [box for box in boxes if box is not None]
    heights = [bottom - top for _, top, _, bottom in valid_boxes]
    widths = [right - left for left, _, right, _ in valid_boxes]
    scale = min(TARGET_HEIGHT / median(heights), MAX_WIDTH / max(widths))
    ground_y = max(bottom for _, _, _, bottom in valid_boxes)
    frames: list[Image.Image] = []
    for slot, box in zip(slots, valid_boxes, strict=True):
        left, top, right, bottom = box
        sprite = slot.crop(box)
        size = (round(sprite.width * scale), round(sprite.height * scale))
        sprite = sprite.resize(size, Image.Resampling.LANCZOS)
        x = round(CELL_WIDTH / 2 - sprite.width / 2)
        y = round(BASELINE + (bottom - ground_y) * scale - sprite.height)
        frame = Image.new("RGBA", (CELL_WIDTH, CELL_HEIGHT), (0, 0, 0, 0))
        frame.alpha_composite(sprite, (x, y)); frames.append(frame)
    return frames


# [待删除-2026-07-21] V2 七行候选包构建器；当前 CLI 已切换到 V3。
def build_outputs(args: argparse.Namespace, rows: dict[str, list[Image.Image]]) -> None:
    candidate = args.output_dir / "candidate"
    qa = args.output_dir / "qa"
    candidate.mkdir(parents=True, exist_ok=True); qa.mkdir(parents=True, exist_ok=True)
    atlas = Image.new("RGBA", (1152, 1456), (0, 0, 0, 0))
    for row_index, (state, duration, loops) in enumerate(STATES):
        frames = rows[state]
        for column, frame in enumerate(frames):
            atlas.alpha_composite(frame, (column * CELL_WIDTH, row_index * CELL_HEIGHT))
        frames[0].save(
            qa / f"{state}.webp", save_all=True, append_images=frames[1:],
            duration=round(duration / FRAME_COUNT), loop=0 if loops else 1,
            lossless=True, method=6,
        )
    atlas.save(candidate / "atlas.webp", lossless=True, method=6)
    rows["idle"][0].resize((88, 96), Image.Resampling.LANCZOS).save(
        candidate / "thumbnail.webp", lossless=True, method=6
    )
    checker = checkerboard(atlas.size); checker.alpha_composite(atlas)
    checker.save(qa / "contact-sheet.png", optimize=True)
    (candidate / "character.json").write_text(
        json.dumps(build_manifest(args), ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def checkerboard(size: tuple[int, int]) -> Image.Image:
    image = Image.new("RGBA", size, "#f7f4ef"); draw = ImageDraw.Draw(image)
    for y in range(0, size[1], 16):
        for x in range(0, size[0], 16):
            if (x // 16 + y // 16) % 2:
                draw.rectangle((x, y, x + 15, y + 15), fill="#e8e3dc")
    return image


# [待删除-2026-07-21] V2 Manifest 构建器；仅为旧工具兼容暂留。
def build_manifest(args: argparse.Namespace) -> dict[str, object]:
    clip = lambda row, duration, loop=True: {
        "row": row, "frames": 6, "durationMs": duration, "loop": loop
    }
    left = {**clip(4, 600), "mirrorX": True}
    return {
        "schemaVersion": 2, "id": args.id, "displayName": args.name, "version": "1.0.0",
        "atlas": {"columns": 6, "rows": 7, "cellWidth": 192, "cellHeight": 208,
                  "renderWidth": 88, "renderHeight": 96},
        "clips": {"idle": clip(0, 1290), "awaken": clip(1, 910, False),
                  "dragging": {"down": clip(2, 600), "up": clip(3, 600),
                               "left": left, "right": clip(4, 600)},
                  "working": clip(5, 880), "complete": clip(6, 940, False)},
    }


def build_candidate(
    character_id: str,
    display_name: str,
    strips_dir: Path,
    output_dir: Path,
    mirror_left: bool = False,
) -> Path:
    """装配十四行图集、缩略图、联系表和逐状态预览。"""
    rows: dict[str, list[Image.Image]] = {}
    for state, _, _, _ in V3_STATE_SPECS:
        source = strips_dir / f"{state}-transparent.png"
        if state == "drag-left" and mirror_left and not source.is_file():
            if "drag-right" not in rows:
                raise ValueError("镜像左行动作前必须先读取右行动作")
            rows[state] = [ImageOps.mirror(frame) for frame in rows["drag-right"]]
        else:
            rows[state] = normalize_row(source)

    candidate = output_dir / "candidate"
    qa = output_dir / "qa"
    previews = qa / "previews"
    candidate.mkdir(parents=True, exist_ok=True)
    previews.mkdir(parents=True, exist_ok=True)
    atlas = Image.new("RGBA", (ATLAS_WIDTH, ATLAS_HEIGHT), (0, 0, 0, 0))
    for row_index, (state, _, duration, loops) in enumerate(V3_STATE_SPECS):
        frames = rows[state]
        for column, frame in enumerate(frames):
            atlas.alpha_composite(frame, (column * CELL_WIDTH, row_index * CELL_HEIGHT))
        frames[0].save(
            previews / f"{state}.webp",
            save_all=True,
            append_images=frames[1:],
            duration=max(1, round(duration / FRAME_COUNT)),
            loop=0 if loops else 1,
            lossless=True,
            method=6,
        )
    atlas.save(candidate / "atlas.webp", lossless=True, method=6)
    rows["idle-base"][0].resize((RENDER_WIDTH, RENDER_HEIGHT), Image.Resampling.LANCZOS).save(
        candidate / "thumbnail.webp", lossless=True, method=6
    )
    contact_sheet = checkerboard(atlas.size)
    contact_sheet.alpha_composite(atlas)
    contact_sheet.save(qa / "contact-sheet.png", optimize=True)
    (candidate / "character.json").write_text(
        json.dumps(build_v3_manifest(character_id, display_name), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return candidate


def main() -> None:
    args = parse_args()
    candidate = build_candidate(
        args.id, args.name, args.strips_dir, args.output_dir, args.mirror_left
    )
    print(candidate)


if __name__ == "__main__":
    main()
