"""角色工厂 V3 的端到端合同测试。"""

from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageDraw, ImageOps

PETS_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PETS_DIR))

from build_character_pack import (  # noqa: E402
    build_candidate,
    build_manifest as build_legacy_manifest,
    normalize_row,
)
from character_pack_v3 import STATE_NAMES, build_manifest, validate_manifest  # noqa: E402
from install_character_pack import install_candidate, validate  # noqa: E402
from prepare_character_pack import create_generation_request  # noqa: E402


class CharacterPackV3Tests(unittest.TestCase):
    def test_prepare_lists_all_fourteen_rows(self) -> None:
        request = create_generation_request("penguin-v3", "企鹅 V3", "three-view.png")

        self.assertEqual(request["schemaVersion"], 3)
        self.assertEqual(request["states"], list(STATE_NAMES))
        self.assertEqual(len(request["states"]), 14)

    def test_builds_v3_atlas_previews_and_uniform_baseline(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            strips = root / "strips"
            self._write_strips(strips)

            candidate = build_candidate("penguin-v3", "企鹅 V3", strips, root / "output")
            manifest = json.loads((candidate / "character.json").read_text(encoding="utf-8"))

            self.assertEqual(manifest["schemaVersion"], 3)
            self.assertEqual(manifest["atlas"]["rows"], 14)
            with Image.open(candidate / "atlas.webp") as atlas:
                self.assertEqual(atlas.size, (1152, 2912))
                self.assertIn("A", atlas.getbands())
                self._assert_uniform_baseline(atlas.convert("RGBA"))
            qa = candidate.parent / "qa"
            self.assertTrue((qa / "contact-sheet.png").is_file())
            self.assertEqual(len(list((qa / "previews").glob("*.webp"))), 14)

    def test_missing_left_row_can_be_built_from_mirrored_right(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            strips = root / "strips"
            self._write_strips(strips, omit={"drag-left"})
            candidate = build_candidate(
                "penguin-v3", "企鹅 V3", strips, root / "output", mirror_left=True
            )

            with Image.open(candidate / "atlas.webp") as atlas:
                atlas = atlas.convert("RGBA")
                right = atlas.crop((0, 5 * 208, 192, 6 * 208))
                left = atlas.crop((0, 6 * 208, 192, 7 * 208))
                self.assertEqual(left.tobytes(), ImageOps.mirror(right).tobytes())

    def test_empty_frame_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            source = Path(temporary) / "empty-frame.png"
            self._write_strip(source, empty_frame=3)

            with self.assertRaisesRegex(ValueError, "空帧"):
                normalize_row(source)

    def test_rgb_checkerboard_is_removed_without_erasing_enclosed_white_detail(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            source = Path(temporary) / "checkerboard.png"
            self._write_checkerboard_strip(source)

            frames = normalize_row(source)

            self.assertEqual(frames[0].getchannel("A").getextrema(), (0, 255))
            self.assertEqual(frames[0].getpixel((96, 100))[:3], (250, 250, 250))

    def test_install_requires_approval_and_never_overwrites_early(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            strips = root / "strips"
            self._write_strips(strips)
            candidate = build_candidate("penguin-v3", "企鹅 V3", strips, root / "output")
            app_root = root / "app"

            with self.assertRaises(PermissionError):
                install_candidate(candidate, app_root, approved=False)
            target = app_root / "apps/desktop/src/renderer/assets/characters/penguin-v3"
            self.assertFalse(target.exists())
            installed = install_candidate(candidate, app_root, approved=True)
            self.assertEqual(installed, target)
            self.assertEqual(validate(installed)["schemaVersion"], 3)

    def test_manifest_rejects_non_string_or_empty_versions(self) -> None:
        for version in (None, 3, ""):
            with self.subTest(version=version):
                manifest = build_manifest("penguin-v3", "企鹅 V3")
                manifest["version"] = version
                with self.assertRaisesRegex(ValueError, "角色版本"):
                    validate_manifest(manifest)

    def test_legacy_manifest_builder_still_returns_a_v2_manifest(self) -> None:
        args = type("Args", (), {"id": "legacy-penguin", "name": "旧企鹅"})()

        manifest = build_legacy_manifest(args)

        self.assertEqual(manifest["schemaVersion"], 2)
        self.assertEqual(manifest["clips"]["dragging"]["left"]["mirrorX"], True)

    def _write_strips(self, directory: Path, omit: set[str] | None = None) -> None:
        directory.mkdir(parents=True, exist_ok=True)
        for state in STATE_NAMES:
            if state not in (omit or set()):
                self._write_strip(directory / f"{state}-transparent.png")

    @staticmethod
    def _write_strip(path: Path, empty_frame: int | None = None) -> None:
        image = Image.new("RGBA", (6 * 96, 128), (0, 0, 0, 0))
        draw = ImageDraw.Draw(image)
        for index in range(6):
            if index == empty_frame:
                continue
            left = index * 96 + 20
            draw.rectangle((left, 18, left + 48, 116), fill=(20, 30, 40, 255))
            draw.rectangle((left + 5, 30, left + 14, 45), fill=(245, 160, 20, 255))
        image.save(path)

    @staticmethod
    def _write_checkerboard_strip(path: Path) -> None:
        image = Image.new("RGB", (6 * 96, 128), (248, 248, 248))
        draw = ImageDraw.Draw(image)
        for y in range(0, image.height, 12):
            for x in range(0, image.width, 12):
                if (x // 12 + y // 12) % 2:
                    draw.rectangle((x, y, x + 11, y + 11), fill=(232, 232, 232))
        for index in range(6):
            left = index * 96 + 18
            draw.ellipse((left, 16, left + 58, 118), fill=(18, 18, 20))
            draw.ellipse((left + 12, 52, left + 46, 102), fill=(250, 250, 250))
        image.save(path)

    def _assert_uniform_baseline(self, atlas: Image.Image) -> None:
        bottoms: set[int] = set()
        for row in range(14):
            for column in range(6):
                frame = atlas.crop((column * 192, row * 208, (column + 1) * 192, (row + 1) * 208))
                box = frame.getchannel("A").getbbox()
                self.assertIsNotNone(box)
                bottoms.add(box[3])
        self.assertEqual(bottoms, {199})


if __name__ == "__main__":
    unittest.main()
