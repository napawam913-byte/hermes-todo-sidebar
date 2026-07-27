/**
 * 模块用途：验证桌宠收起不改变工作页面，设置页返回和顶部模式保持一致。
 * 模块边界：只测试纯导航状态，不挂载 React 或调用 Electron。
 */
import { describe, expect, it } from "vitest";

describe("PanelSessionState", () => {
  it("keeps the exact work surface when the pet collapses", async () => {
    const module = await import("./panelSessionState").catch(() => null);
    expect(module).not.toBeNull();
    if (!module) return;
    const aiState = module.reducePanelSessionState(
      module.createPanelSessionState(),
      { type: "surface.opened", surface: "ai" }
    );

    const collapsed = module.reducePanelSessionState(aiState, { type: "panel.collapsed" });

    expect(collapsed.surface).toBe("ai");
    expect(collapsed.interactionResetVersion).toBe(1);
    expect(module.getPanelMode(collapsed)).toBe("cycle");
  });

  it("returns from settings to the content surface that opened it", async () => {
    const module = await import("./panelSessionState").catch(() => null);
    expect(module).not.toBeNull();
    if (!module) return;
    const cycle = module.reducePanelSessionState(
      module.createPanelSessionState(),
      { type: "mode.selected", mode: "cycle" }
    );
    const settings = module.reducePanelSessionState(cycle, { type: "settings.opened" });
    const returned = module.reducePanelSessionState(settings, { type: "settings.closed" });

    expect(settings.surface).toBe("settings");
    expect(returned.surface).toBe("cycle");
  });

  it("remembers the selected settings section across collapse and reopen", async () => {
    const module = await import("./panelSessionState").catch(() => null);
    expect(module).not.toBeNull();
    if (!module) return;
    const cycle = module.reducePanelSessionState(
      module.createPanelSessionState(),
      { type: "mode.selected", mode: "cycle" }
    );
    const settings = module.reducePanelSessionState(cycle, { type: "settings.opened" });
    const data = module.reducePanelSessionState(settings, {
      type: "settings.section-selected",
      section: "data"
    });
    const collapsed = module.reducePanelSessionState(data, { type: "panel.collapsed" });
    const closed = module.reducePanelSessionState(collapsed, { type: "settings.closed" });
    const reopened = module.reducePanelSessionState(closed, { type: "settings.opened" });

    expect(data.settingsSection).toBe("data");
    expect(collapsed.settingsSection).toBe("data");
    expect(reopened.settingsSection).toBe("data");
    expect(reopened.returnSurface).toBe("cycle");
  });
});
