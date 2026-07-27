/**
 * 模块用途：验证浏览器预览按当前 viewport 模拟 Electron 响应式面板尺寸。
 * 模块边界：只测试纯几何，不读取 screen、DOM 或 Electron IPC。
 */
import { describe, expect, it } from "vitest";
import { calculateBrowserPanelSize } from "./browserPanelLayout";

describe("browser panel layout", () => {
  it("主屏预览使用约 50% 宽度和 57% 高度", () => {
    expect(calculateBrowserPanelSize(1707, 1019)).toEqual({
      panelWidth: 854,
      panelHeight: 581
    });
  });

  it("窄屏保持 360px 最小宽度并按高度响应", () => {
    expect(calculateBrowserPanelSize(720, 1232)).toEqual({
      panelWidth: 360,
      panelHeight: 702
    });
  });

  it("极小 viewport 优先限制在可见区域", () => {
    expect(calculateBrowserPanelSize(320, 400)).toEqual({
      panelWidth: 320,
      panelHeight: 296
    });
  });
});
