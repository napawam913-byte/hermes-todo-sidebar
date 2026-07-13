/**
 * 模块用途：验证桌宠点击与拖动的 5px 阈值及取消行为。
 * 模块边界：只测试坐标状态机，不读取鼠标或操作窗口。
 */
import { describe, expect, it } from "vitest";
import { PetDragSession } from "./petDragSession.js";

describe("PetDragSession", () => {
  it("移动距离不超过 5px 时仍判定为点击", () => {
    const session = new PetDragSession(5);
    session.start({ x: 100, y: 100 }, { x: 500, y: 300 });

    expect(session.update({ x: 103, y: 104 })).toEqual({ dragging: false });
    expect(session.end()).toEqual({ dragged: false, position: { x: 500, y: 300 } });
  });

  it("移动超过 5px 后按起始偏移实时计算桌宠位置", () => {
    const session = new PetDragSession(5);
    session.start({ x: 100, y: 100 }, { x: 500, y: 300 });

    expect(session.update({ x: 106, y: 100 })).toEqual({
      dragging: true,
      position: { x: 506, y: 300 }
    });
    expect(session.end()).toEqual({ dragged: true, position: { x: 506, y: 300 } });
  });

  it("取消拖动时恢复起始位置", () => {
    const session = new PetDragSession(5);
    session.start({ x: 20, y: 20 }, { x: 80, y: 60 });
    session.update({ x: 60, y: 50 });

    expect(session.cancel()).toEqual({ x: 80, y: 60 });
  });
});
