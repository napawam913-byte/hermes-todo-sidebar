/**
 * 模块用途：验证主进程按 Pointer 抓取偏移计算窗口位置并隔离过期会话。
 * 模块边界：只测试坐标状态机，不读取鼠标或操作窗口。
 */
import { describe, expect, it } from "vitest";
import type {
  PetDragPointerSample,
  PetDragStartSample
} from "../../shared/petDragContract.js";
import { PetDragSession } from "./petDragSession.js";

const startSample: PetDragStartSample = {
  pointerId: 3,
  screenX: 1600,
  screenY: 900,
  clientX: 5,
  clientY: 1,
  timeMs: 10
};

function point(
  screenX: number,
  screenY: number,
  timeMs = 20,
  pointerId = startSample.pointerId
): PetDragPointerSample {
  return { pointerId, screenX, screenY, timeMs };
}

describe("PetDragSession", () => {
  it("没有收到有效 move 时按点击结束", () => {
    const session = new PetDragSession();
    session.start(startSample, { x: 1595, y: 899 });

    expect(session.end(point(1603, 903))).toEqual({
      dragged: false,
      position: { x: 1595, y: 899 }
    });
  });

  it("保持按下点偏移并使用结束样本计算最终位置", () => {
    const session = new PetDragSession();
    session.start(startSample, { x: 1595, y: 899 });

    expect(session.update(point(1800, 900))).toEqual({
      position: { x: 1795, y: 899 }
    });
    expect(session.end(point(1815, 910, 30))).toEqual({
      dragged: true,
      position: { x: 1810, y: 909 }
    });
  });

  it("忽略过期时间和不匹配的 pointerId", () => {
    const session = new PetDragSession();
    session.start(startSample, { x: 1595, y: 899 });

    expect(session.update(point(1700, 900, 9))).toBeUndefined();
    expect(session.update(point(1700, 900, 20, 99))).toBeUndefined();
  });

  it("取消当前会话时恢复起始位置", () => {
    const session = new PetDragSession();
    session.start(startSample, { x: 1595, y: 899 });
    session.update(point(1800, 900));

    expect(session.cancel(99)).toBeUndefined();
    expect(session.cancel(3)).toEqual({ x: 1595, y: 899 });
  });
});
