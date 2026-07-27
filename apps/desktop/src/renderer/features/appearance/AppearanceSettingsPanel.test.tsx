/**
 * 模块用途：验证外观设置分区提供角色网格和可访问的透明度滑块。
 * 模块边界：只检查静态表单语义，不测试浏览器事件和本地存储。
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createTestCharacterPack } from "../sidebar/testCharacterPack";
import { AppearanceSettingsPanel } from "./AppearanceSettingsPanel";

describe("AppearanceSettingsPanel", () => {
  it("显示 72% 到 94% 的受控面板不透明度滑块", () => {
    const html = renderToStaticMarkup(
      <AppearanceSettingsPanel
        characterId="penguin-todo"
        characters={[penguinPack]}
        panelOpacity={86}
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
    expect(html).toContain("当前使用");
    expect(html).toContain("企鹅待办助手");
    expect(html).toContain("<h2>外观</h2>");
    expect(html).not.toContain("appearance-settings-card");
    expect(html).not.toContain("detail-page");
    expect(html).not.toContain("模型连接设置");
  });
});

const penguinPack = createTestCharacterPack();
