/**
 * 模块用途：用测试固定 CharacterPack V3 的十四行动作合同与旧角色包回退。
 * 模块边界：不加载真实图片，只验证清单规范化后的运行时动作映射。
 */
import { describe, expect, it } from "vitest";
import {
  normalizeCharacterPackManifest,
  type CharacterPackManifestV2,
  type CharacterPackManifestV3
} from "./characterPack";

const atlasV3 = {
  columns: 6 as const,
  rows: 14 as const,
  cellWidth: 192 as const,
  cellHeight: 208 as const,
  renderWidth: 88 as const,
  renderHeight: 96 as const
};

const row = (value: number) => ({ row: value });

const manifestV3: CharacterPackManifestV3 = {
  schemaVersion: 3,
  id: "penguin-v3",
  displayName: "企鹅 V3",
  version: "1.0.0",
  atlas: atlasV3,
  clips: {
    idle: { base: row(0), blink: row(1) },
    awaken: row(2),
    dragging: { down: row(3), up: row(4), right: row(5), left: row(6) },
    thinking: row(7),
    working: row(8),
    waiting: row(9),
    reminding: row(10),
    complete: row(11),
    error: row(12),
    sleeping: row(13)
  }
};

describe("CharacterPack V3", () => {
  it("接受完整的固定十四行角色包", () => {
    const normalized = normalizeCharacterPackManifest(manifestV3);

    expect(normalized.schemaVersion).toBe(3);
    expect(normalized.atlas.rows).toBe(14);
    expect(normalized.clips.idle.blink.row).toBe(1);
    expect(normalized.clips.sleeping.row).toBe(13);
  });

  it("拒绝动作放入错误的标准行", () => {
    expect(() => normalizeCharacterPackManifest({
      ...manifestV3,
      clips: { ...manifestV3.clips, thinking: row(8) }
    })).toThrow("thinking 行号必须为 7");
  });

  it("把 v2 缺失状态映射为稳定回退动作", () => {
    const legacy = createLegacyManifest();
    const normalized = normalizeCharacterPackManifest(legacy);

    expect(normalized.schemaVersion).toBe(3);
    expect(normalized.clips.thinking.row).toBe(5);
    expect(normalized.clips.waiting.row).toBe(0);
    expect(normalized.clips.reminding.row).toBe(1);
    expect(normalized.clips.error.row).toBe(0);
    expect(normalized.clips.sleeping.row).toBe(0);
    expect(normalized.clips.dragging.left.mirrorX).toBe(true);
  });
});

function createLegacyManifest(): CharacterPackManifestV2 {
  const clip = (clipRow: number, loop = true, mirrorX?: boolean) => ({
    row: clipRow,
    frames: 6 as const,
    durationMs: 600,
    loop,
    ...(mirrorX === undefined ? {} : { mirrorX })
  });
  return {
    schemaVersion: 2,
    id: "legacy-penguin",
    displayName: "旧企鹅",
    version: "1.0.0",
    atlas: { ...atlasV3, rows: 7 },
    clips: {
      idle: clip(0), awaken: clip(1, false),
      dragging: {
        down: clip(2), up: clip(3), right: clip(4), left: clip(4, true, true)
      },
      working: clip(5), complete: clip(6, false)
    }
  };
}
