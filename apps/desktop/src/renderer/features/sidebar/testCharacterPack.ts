/**
 * 模块用途：为静态渲染测试提供最小且合法的 CharacterPack V3 夹具。
 * 模块边界：只供测试使用，不参与角色注册、旧包迁移或真实资源加载。
 */
import type { CharacterPack } from "./characterPack";
import type { CharacterClipV3 } from "./characterPackV3";

const clip = (row: number): CharacterClipV3 => ({ row, mirrorX: false });

export function createTestCharacterPack(
  id = "penguin-todo",
  displayName = "企鹅待办助手"
): CharacterPack {
  return {
    atlasUrl: "/atlas.webp",
    thumbnailUrl: "/penguin.webp",
    manifest: {
      schemaVersion: 3,
      id,
      displayName,
      version: "3.0.0-test",
      atlas: {
        columns: 6,
        rows: 14,
        cellWidth: 192,
        cellHeight: 208,
        renderWidth: 88,
        renderHeight: 96
      },
      clips: {
        idle: { base: clip(0), blink: clip(1) },
        awaken: clip(2),
        dragging: {
          down: clip(3), up: clip(4), right: clip(5), left: clip(6)
        },
        thinking: clip(7),
        working: clip(8),
        waiting: clip(9),
        reminding: clip(10),
        complete: clip(11),
        error: clip(12),
        sleeping: clip(13)
      }
    }
  };
}
