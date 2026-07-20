/**
 * 模块用途：验证角色选择器展示已安装角色并标记当前选择。
 * 模块边界：不测试角色发现、图集播放或设置持久化。
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CharacterPack } from "../sidebar/characterPack";
import { CharacterPicker } from "./CharacterPicker";

describe("CharacterPicker", () => {
  it("用单选语义展示角色缩略图和名称", () => {
    const html = renderToStaticMarkup(
      <CharacterPicker
        characters={[createPack("penguin-todo", "企鹅待办助手")]}
        selectedId="penguin-todo"
        onChange={() => undefined}
      />
    );

    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain("企鹅待办助手");
    expect(html).toContain("/penguin.webp");
  });
});

function createPack(id: string, displayName: string): CharacterPack {
  const clip = (row: number) => ({ row, frames: 6 as const, durationMs: 600, loop: true });
  return {
    atlasUrl: "/atlas.webp",
    thumbnailUrl: "/penguin.webp",
    manifest: {
      schemaVersion: 2,
      id,
      displayName,
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
        idle: clip(0), awaken: clip(1),
        dragging: { down: clip(2), up: clip(3), left: clip(4), right: clip(4) },
        working: clip(5), complete: clip(6)
      }
    }
  };
}
