/**
 * 模块用途：验证桌宠锚定面板在上下空间和多显示器坐标下的布局。
 * 模块边界：只测试纯几何，不创建 Electron BrowserWindow。
 */
import { describe, expect, it } from "vitest";
import { calculateExpandedPanelBounds } from "./petWindowBounds.js";

describe("calculateExpandedPanelBounds", () => {
  it("默认在空间更大的下方展开，并保持桌宠为窗口锚点", () => {
    const layout = calculateExpandedPanelBounds(
      { x: 0, y: 0, width: 1200, height: 900 },
      { x: 700, y: 100 }
    );

    expect(layout).toEqual({
      direction: "down",
      panelHeight: 560,
      windowBounds: { x: 428, y: 100, width: 360, height: 664 },
      petOffset: { x: 272, y: 0 }
    });
  });

  it("桌宠靠近底部时向上展开", () => {
    const layout = calculateExpandedPanelBounds(
      { x: 0, y: 0, width: 1200, height: 900 },
      { x: 700, y: 760 }
    );

    expect(layout).toEqual({
      direction: "up",
      panelHeight: 560,
      windowBounds: { x: 428, y: 192, width: 360, height: 664 },
      petOffset: { x: 272, y: 568 }
    });
  });

  it("副屏空间不足时缩短面板并把水平位置限制在工作区", () => {
    const layout = calculateExpandedPanelBounds(
      { x: 1707, y: 0, width: 720, height: 400 },
      { x: 1800, y: 140 }
    );

    expect(layout).toEqual({
      direction: "down",
      panelHeight: 156,
      windowBounds: { x: 1707, y: 140, width: 360, height: 260 },
      petOffset: { x: 93, y: 0 }
    });
  });
});
