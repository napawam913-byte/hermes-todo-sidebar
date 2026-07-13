/**
 * 模块用途：验证 renderer 指针会话只在未拖动时触发展开。
 * 模块边界：不依赖 React 事件或 Electron 窗口，只调用安全 bridge。
 */
import { describe, expect, it, vi } from "vitest";
import type {
  PetDragPointerSample,
  PetDragStartSample
} from "../../../shared/petDragContract";
import { PetDragInteraction } from "./petDragInteraction";

const startSample: PetDragStartSample = {
  pointerId: 11,
  screenX: 100,
  screenY: 100,
  clientX: 20,
  clientY: 24,
  timeMs: 10
};

function pointerSample(
  screenX: number,
  screenY: number,
  pointerId = startSample.pointerId,
  timeMs = 20
): PetDragPointerSample {
  return { pointerId, screenX, screenY, timeMs };
}

function createBridge() {
  return {
    startDrag: vi.fn(),
    updateDrag: vi.fn(),
    endDrag: vi.fn(),
    cancelDrag: vi.fn()
  };
}

describe("PetDragInteraction", () => {
  it("两个方向都小于 4px 时按点击结束", () => {
    const bridge = createBridge();
    const activate = vi.fn();
    const interaction = new PetDragInteraction({ bridge, onActivate: activate });
    const endSample = pointerSample(103, 103);

    interaction.start(startSample);
    interaction.move(endSample);
    interaction.end(endSample);

    expect(bridge.startDrag).toHaveBeenCalledWith(startSample);
    expect(bridge.updateDrag).not.toHaveBeenCalled();
    expect(bridge.endDrag).toHaveBeenCalledWith(endSample);
    expect(activate).toHaveBeenCalledOnce();
  });

  it("任一方向达到 4px 时立即进入拖动", () => {
    const bridge = createBridge();
    const activate = vi.fn();
    const setDragging = vi.fn();
    const interaction = new PetDragInteraction({
      bridge,
      onActivate: activate,
      onDraggingChange: setDragging
    });
    const moveSample = pointerSample(104, 100);

    interaction.start(startSample);
    interaction.move(moveSample);
    interaction.end(moveSample);

    expect(bridge.updateDrag).toHaveBeenCalledWith(moveSample);
    expect(activate).not.toHaveBeenCalled();
    expect(setDragging).toHaveBeenCalledWith(true);
    expect(setDragging).toHaveBeenLastCalledWith(false);
  });

  it("更新点击回调时保留按下中的 Pointer 会话", () => {
    const bridge = createBridge();
    const originalActivate = vi.fn();
    const latestActivate = vi.fn();
    const interaction = new PetDragInteraction({
      bridge,
      onActivate: originalActivate
    });

    interaction.start(startSample);
    interaction.setOnActivate(latestActivate);
    interaction.end(pointerSample(100, 100));

    expect(originalActivate).not.toHaveBeenCalled();
    expect(latestActivate).toHaveBeenCalledOnce();
  });

  it("忽略不属于当前会话的 pointerId", () => {
    const bridge = createBridge();
    const activate = vi.fn();
    const interaction = new PetDragInteraction({ bridge, onActivate: activate });

    interaction.start(startSample);
    interaction.move(pointerSample(150, 150, 99));
    interaction.end(pointerSample(150, 150, 99));

    expect(bridge.updateDrag).not.toHaveBeenCalled();
    expect(bridge.endDrag).not.toHaveBeenCalled();
    expect(activate).not.toHaveBeenCalled();
  });
});
