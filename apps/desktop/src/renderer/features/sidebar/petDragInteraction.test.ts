/**
 * 模块用途：验证 renderer 指针会话只在未拖动时触发展开。
 * 模块边界：不依赖 React 事件或 Electron 窗口，只调用安全 bridge。
 */
import { describe, expect, it, vi } from "vitest";
import { PetDragInteraction } from "./petDragInteraction";

function createBridge(dragged: boolean) {
  return {
    startDrag: vi.fn(async () => true),
    updateDrag: vi.fn(async () => ({ dragging: dragged })),
    endDrag: vi.fn(async () => ({ dragged })),
    cancelDrag: vi.fn(async () => undefined)
  };
}

describe("PetDragInteraction", () => {
  it("松手时未发生拖动则触发桌宠点击", async () => {
    const bridge = createBridge(false);
    const activate = vi.fn();
    const interaction = new PetDragInteraction({ bridge, onActivate: activate });

    await interaction.start();
    await interaction.move();
    await interaction.end();

    expect(activate).toHaveBeenCalledOnce();
  });

  it("发生拖动后松手不触发展开", async () => {
    const bridge = createBridge(true);
    const activate = vi.fn();
    const setDragging = vi.fn();
    const interaction = new PetDragInteraction({
      bridge,
      onActivate: activate,
      onDraggingChange: setDragging
    });

    await interaction.start();
    await interaction.move();
    await interaction.end();

    expect(activate).not.toHaveBeenCalled();
    expect(setDragging).toHaveBeenCalledWith(true);
    expect(setDragging).toHaveBeenLastCalledWith(false);
  });
});
