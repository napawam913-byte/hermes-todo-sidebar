/**
 * 模块用途：验证外观设置页提供可访问的透明度滑块和模型设置入口。
 * 模块边界：只检查静态表单语义，不测试浏览器事件和本地存储。
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CharacterPack } from "../sidebar/characterPack";
import { AppearanceSettingsPanel } from "./AppearanceSettingsPanel";

describe("AppearanceSettingsPanel", () => {
  it("显示 72% 到 94% 的受控面板不透明度滑块", () => {
    const html = renderToStaticMarkup(
      <AppearanceSettingsPanel
        characterId="penguin-todo"
        characters={[penguinPack]}
        panelOpacity={86}
        onBack={() => undefined}
        onOpenAiConfig={() => undefined}
        onCharacterChange={() => undefined}
        onPanelOpacityChange={() => undefined}
      />
    );

    expect(html).toContain('aria-label="面板不透明度"');
    expect(html).toContain('min="72"');
    expect(html).toContain('max="94"');
    expect(html).toContain('value="86"');
    expect(html).toContain("86%");
    expect(html).toContain("角色只改变桌宠外观和动作，待办界面保持一致");
    expect(html).toContain("模型连接设置");
    expect(html).toContain("企鹅待办助手");
  });
});

const clip = (row: number) => ({ row, frames: 6 as const, durationMs: 600, loop: true });
const penguinPack: CharacterPack = {
  atlasUrl: "/atlas.webp",
  thumbnailUrl: "/penguin.webp",
  manifest: {
    schemaVersion: 2,
    id: "penguin-todo",
    displayName: "企鹅待办助手",
    version: "1.0.0",
    atlas: {
      columns: 6, rows: 7, cellWidth: 192, cellHeight: 208,
      renderWidth: 88, renderHeight: 96
    },
    clips: {
      idle: clip(0), awaken: clip(1),
      dragging: { down: clip(2), up: clip(3), left: clip(4), right: clip(4) },
      working: clip(5), complete: clip(6)
    }
  }
};
