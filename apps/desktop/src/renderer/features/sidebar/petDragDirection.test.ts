/**
 * 模块用途：验证桌宠拖动方向的四向识别、最小采样距离和轴向切换稳定性。
 * 模块边界：只测试屏幕坐标纯逻辑，不访问 PointerEvent、React 或 Electron。
 */
import { describe, expect, it } from "vitest";
import {
  createPetDragDirectionTracker,
  updatePetDragDirection
} from "./petDragDirection";

describe("桌宠拖动方向", () => {
  it.each([
    ["right", 104, 100],
    ["left", 96, 100],
    ["down", 100, 104],
    ["up", 100, 96]
  ] as const)("识别 %s 方向", (direction, screenX, screenY) => {
    const tracker = createPetDragDirectionTracker({ screenX: 100, screenY: 100 });
    expect(updatePetDragDirection(tracker, { screenX, screenY }).direction).toBe(direction);
  });

  it("累计移动不足 3px 时保留方向和锚点", () => {
    const tracker = createPetDragDirectionTracker({ screenX: 100, screenY: 100 }, "right");
    expect(updatePetDragDirection(tracker, { screenX: 102, screenY: 102 })).toEqual(tracker);
  });

  it("斜向轻微抖动不会从当前横轴切换到纵轴", () => {
    const tracker = createPetDragDirectionTracker({ screenX: 100, screenY: 100 }, "right");
    expect(updatePetDragDirection(tracker, { screenX: 104, screenY: 104 }).direction).toBe("right");
  });

  it("新轴达到 1.25 倍优势时允许切换", () => {
    const tracker = createPetDragDirectionTracker({ screenX: 100, screenY: 100 }, "right");
    expect(updatePetDragDirection(tracker, { screenX: 102, screenY: 104 }).direction).toBe("down");
  });

  it("同一轴反向移动时立即转身", () => {
    const tracker = createPetDragDirectionTracker({ screenX: 100, screenY: 100 }, "right");
    expect(updatePetDragDirection(tracker, { screenX: 97, screenY: 100 }).direction).toBe("left");
  });
});
