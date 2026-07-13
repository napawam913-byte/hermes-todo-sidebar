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
  it("普通点击留给原生 click 处理且不设置抑制", () => {
    const bridge = createBridge();
    const interaction = new PetDragInteraction({ bridge });
    const endSample = pointerSample(103, 103);

    interaction.start(startSample);
    interaction.move(endSample);
    interaction.end(endSample);

    expect(bridge.startDrag).toHaveBeenCalledWith(startSample);
    expect(bridge.updateDrag).not.toHaveBeenCalled();
    expect(bridge.endDrag).toHaveBeenCalledWith(endSample);
    expect(interaction.consumeClickSuppression()).toBe(false);
  });

  it("拖动后的原生 click 只被抑制一次", () => {
    const bridge = createBridge();
    const setDragging = vi.fn();
    const interaction = new PetDragInteraction({
      bridge,
      onDraggingChange: setDragging
    });
    const moveSample = pointerSample(104, 100);

    interaction.start(startSample);
    interaction.move(moveSample);
    interaction.end(moveSample);

    expect(bridge.updateDrag).toHaveBeenCalledWith(moveSample);
    expect(setDragging).toHaveBeenCalledWith(true);
    expect(setDragging).toHaveBeenLastCalledWith(false);
    expect(interaction.consumeClickSuppression()).toBe(true);
    expect(interaction.consumeClickSuppression()).toBe(false);
  });

  it("新 Pointer 会话清除未消费的旧 click 抑制", () => {
    const bridge = createBridge();
    const interaction = new PetDragInteraction({ bridge });

    interaction.start(startSample);
    interaction.move(pointerSample(104, 100));
    interaction.end(pointerSample(104, 100));
    interaction.start({ ...startSample, pointerId: 12, timeMs: 30 });
    interaction.end(pointerSample(100, 100, 12, 40));

    expect(interaction.consumeClickSuppression()).toBe(false);
  });

  it("忽略不属于当前会话的 pointerId", () => {
    const bridge = createBridge();
    const interaction = new PetDragInteraction({ bridge });

    interaction.start(startSample);
    interaction.move(pointerSample(150, 150, 99));
    interaction.end(pointerSample(150, 150, 99));

    expect(bridge.updateDrag).not.toHaveBeenCalled();
    expect(bridge.endDrag).not.toHaveBeenCalled();
    expect(interaction.consumeClickSuppression()).toBe(false);
  });
});
