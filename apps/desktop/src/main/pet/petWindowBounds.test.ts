/**
 * 模块用途：验证桌宠入口与展开面板的窗口尺寸计算入口。
 * 模块边界：复用 sidebar 几何计算，不依赖 Electron BrowserWindow。
 */
import { describe, expect, it } from "vitest";
import { calculateExpandedPanelBounds, calculatePetIdleBounds } from "./petWindowBounds.js";

describe("petWindowBounds", () => {
  it("calculates desktop pet idle bounds separately from expanded panel bounds", () => {
    const workArea = { x: 0, y: 40, width: 1440, height: 860 };

    expect(calculatePetIdleBounds(workArea)).toEqual({
      x: 1328,
      y: 780,
      width: 88,
      height: 96
    });
    expect(calculateExpandedPanelBounds(workArea)).toEqual({
      x: 1080,
      y: 40,
      width: 360,
      height: 860
    });
  });
});
