"""Build a seven-row CharacterPack candidate from approved transparent strips."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from statistics import median

from PIL import Image, ImageDraw

FRAME_COUNT = 6
CELL_WIDTH, CELL_HEIGHT = 192, 208
RENDER_WIDTH, RENDER_HEIGHT = 88, 96
TARGET_HEIGHT, MAX_WIDTH, BASELINE = 184, 178, 198
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
    slots = split_poses(Image.open(source).convert("RGBA"))
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


def main() -> None:
    args = parse_args()
    rows = {state: normalize_row(args.strips_dir / f"{state}-transparent.png")
            for state, _, _ in STATES}
    build_outputs(args, rows); print(args.output_dir / "candidate")


if __name__ == "__main__":
    main()
