/**
 * 模块用途：验证旧角色包合同、V1/V2 兼容迁移和默认角色回退。
 * 模块边界：不加载真实图片，也不依赖 Vite 的资源发现能力。
 */
import { describe, expect, it } from "vitest";
import { createCharacterRegistry } from "./characterRegistry";
import {
  normalizeCharacterPackManifest,
  type CharacterPackManifestV1,
  type CharacterPackManifestV2
} from "./characterPack";

const clip = (row: number, mirrorX = false) => ({
  row,
  frames: 6 as const,
  durationMs: 600,
  loop: true,
  mirrorX
});

const validV1Manifest: CharacterPackManifestV1 = {
  schemaVersion: 1,
  id: "penguin-todo",
  displayName: "企鹅待办助手",
  version: "1.0.0",
  atlas: {
    columns: 6,
    rows: 7,
    cellWidth: 192,
    cellHeight: 208,
    renderWidth: 88,
    renderHeight: 96
  },
  clips: {
    idle: clip(0),
    awaken: { ...clip(1), loop: false },
    dragging: {
      down: clip(2),
      up: clip(3),
      right: clip(4),
      left: clip(4, true)
    },
    working: clip(5),
    complete: { ...clip(6), loop: false }
  },
  theme: {
    accent: "#f5a623",
    accentStrong: "#8a4b00",
    accentSoft: "#ffe2ae",
    surfaceTint: "#fbf5e9"
  }
};

const validV2Manifest: CharacterPackManifestV2 = {
  schemaVersion: 2,
  id: validV1Manifest.id,
  displayName: validV1Manifest.displayName,
  version: validV1Manifest.version,
  atlas: validV1Manifest.atlas,
  clips: validV1Manifest.clips
};

describe("角色包 Manifest", () => {
  it("接受完整的 v2 角色包并升级到统一运行时合同", () => {
    expect(normalizeCharacterPackManifest(validV2Manifest).schemaVersion).toBe(3);
  });

  it("把 v1 主题角色包规范化为无主题的 v3", () => {
    const normalized = normalizeCharacterPackManifest(validV1Manifest);

    expect(normalized.schemaVersion).toBe(3);
    expect("theme" in normalized).toBe(false);
    expect(normalized.id).toBe("penguin-todo");
  });

  it("拒绝带主题字段的 v2 角色包", () => {
    expect(() => normalizeCharacterPackManifest({
      ...validV2Manifest,
      theme: validV1Manifest.theme
    })).toThrow("未知字段");
  });

  it("拒绝缺少标准动作的角色包", () => {
    expect(() => normalizeCharacterPackManifest({
      ...validV2Manifest,
      clips: {
        idle: validV2Manifest.clips.idle,
        awaken: validV2Manifest.clips.awaken,
        dragging: validV2Manifest.clips.dragging,
        working: validV2Manifest.clips.working
      }
    })).toThrow("未知字段");
  });

  it("拒绝动作放入错误的固定行", () => {
    expect(() => normalizeCharacterPackManifest({
      ...validV2Manifest,
      clips: { ...validV2Manifest.clips, idle: clip(6) }
    })).toThrow("idle 行号");
  });

  it("拒绝错误的左右镜像配置", () => {
    expect(() => normalizeCharacterPackManifest({
      ...validV2Manifest,
      clips: {
        ...validV2Manifest.clips,
        dragging: { ...validV2Manifest.clips.dragging, left: clip(4) }
      }
    })).toThrow("镜像");
    expect(() => normalizeCharacterPackManifest({
      ...validV2Manifest,
      clips: {
        ...validV2Manifest.clips,
        dragging: { ...validV2Manifest.clips.dragging, right: clip(4, true) }
      }
    })).toThrow("镜像");
  });

  it("先按旧合同严格校验 v1 角色包", () => {
    expect(() => normalizeCharacterPackManifest({
      ...validV1Manifest,
      clips: { ...validV1Manifest.clips, working: clip(7) }
    })).toThrow("行号");
    expect(() => normalizeCharacterPackManifest({
      ...validV1Manifest,
      theme: { ...validV1Manifest.theme, accent: "red" }
    })).toThrow("颜色");
  });

  it("已选角色不存在时回退到默认企鹅", () => {
    const penguin = { manifest: validV1Manifest, atlasUrl: "penguin.webp", thumbnailUrl: "penguin.png" };
    const registry = createCharacterRegistry([penguin], "penguin-todo");
    const fallback = registry.resolve("missing-character");

    expect(fallback.manifest.id).toBe("penguin-todo");
    expect(fallback.manifest.schemaVersion).toBe(3);
    expect("theme" in fallback.manifest).toBe(false);
  });
});
