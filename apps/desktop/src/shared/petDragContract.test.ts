/**
 * 模块用途：验证桌宠拖动 IPC 坐标协议只接收完整、有限且可排序的 Pointer 样本。
 * 模块边界：只测试共享数据校验，不创建 Electron 窗口或 React 事件。
 */
import { describe, expect, it } from "vitest";
import { isPetDragPointerSample, isPetDragStartSample } from "./petDragContract.js";

describe("petDragContract", () => {
  it("接受合法的开始样本和负屏幕坐标", () => {
    expect(isPetDragStartSample({
      pointerId: 7,
      screenX: -320,
      screenY: 80,
      clientX: 12,
      clientY: 18,
      timeMs: 42
    })).toBe(true);
  });

  it("拒绝非有限坐标与不完整移动样本", () => {
    expect(isPetDragPointerSample({
      pointerId: 7,
      screenX: Number.NaN,
      screenY: 80,
      timeMs: 43
    })).toBe(false);
    expect(isPetDragPointerSample({ pointerId: 7, screenX: 20 })).toBe(false);
  });
});
