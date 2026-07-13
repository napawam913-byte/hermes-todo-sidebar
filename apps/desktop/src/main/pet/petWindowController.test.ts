/**
 * 模块用途：验证桌宠窗口编排、跨屏拖动和一次性位置保存。
 * 模块边界：使用端口替身，不创建真实 BrowserWindow 或 Electron screen。
 */
import { describe, expect, it, vi } from "vitest";
import { PetWindowController, type PetScreenPort, type PetWindowPort } from "./petWindowController.js";

const displays = [
  { id: 1, workArea: { x: 0, y: 0, width: 1707, height: 1019 } },
  { id: 2, workArea: { x: 1707, y: 0, width: 720, height: 1232 } }
];

function createHarness(saved?: { displayId: number; x: number; y: number }) {
  let cursor = { x: 1600, y: 900 };
  let activeDisplays = displays;
  const bounds: Array<{ x: number; y: number; width: number; height: number }> = [];
  const snapshots: unknown[] = [];
  const save = vi.fn(async () => undefined);
  const windowPort: PetWindowPort = {
    setBounds: (next) => bounds.push(next),
    sendLayout: (snapshot) => snapshots.push(snapshot)
  };
  const screenPort: PetScreenPort = {
    getCursorPoint: () => cursor,
    getDisplays: () => activeDisplays,
    getPrimaryDisplayId: () => 1,
    getDisplayNearestPoint: (point) => {
      const secondary = activeDisplays.find((display) => display.id === 2);
      return point.x >= 1707 && secondary ? secondary : activeDisplays[0];
    }
  };
  const controller = new PetWindowController({
    window: windowPort,
    screen: screenPort,
    positionStore: { load: async () => saved, save }
  });
  return {
    bounds,
    controller,
    save,
    snapshots,
    setDisplays: (next: typeof displays) => { activeDisplays = next; },
    setCursor: (next: { x: number; y: number }) => { cursor = next; }
  };
}

describe("PetWindowController", () => {
  it("小幅移动按点击结束且不保存位置", async () => {
    const harness = createHarness();
    await harness.controller.initialize();
    harness.controller.startDrag();
    harness.setCursor({ x: 1603, y: 904 });

    expect(harness.controller.updateDrag()).toEqual({ dragging: false });
    await expect(harness.controller.endDrag()).resolves.toEqual({ dragged: false });
    expect(harness.save).not.toHaveBeenCalled();
  });

  it("跨到副屏拖动后只在松手时保存一次", async () => {
    const harness = createHarness();
    await harness.controller.initialize();
    harness.controller.startDrag();
    harness.setCursor({ x: 1800, y: 900 });

    expect(harness.controller.updateDrag()).toEqual({ dragging: true });
    expect(harness.save).not.toHaveBeenCalled();
    await expect(harness.controller.endDrag()).resolves.toEqual({ dragged: true });
    expect(harness.save).toHaveBeenCalledTimes(1);
    expect(harness.save).toHaveBeenCalledWith({ displayId: 2, x: 1795, y: 899 });
  });

  it("展开时返回与桌宠位置一致的锚定布局快照", async () => {
    const harness = createHarness();
    await harness.controller.initialize();

    const snapshot = harness.controller.setExpanded(true);

    expect(snapshot).toMatchObject({
      expanded: true,
      direction: "up",
      panelHeight: 560,
      petOffsetX: 272,
      petOffsetY: 568
    });
    expect(harness.bounds.at(-1)).toEqual({ x: 1323, y: 331, width: 360, height: 664 });
  });

  it("显示器断开后把桌宠恢复到主屏并保存校正位置", async () => {
    const harness = createHarness({ displayId: 2, x: 1800, y: 700 });
    await harness.controller.initialize();
    harness.setDisplays([displays[0]]);

    await harness.controller.recoverDisplayLayout();

    expect(harness.bounds.at(-1)).toEqual({ x: 1595, y: 899, width: 88, height: 96 });
    expect(harness.save).toHaveBeenLastCalledWith({ displayId: 1, x: 1595, y: 899 });
  });
});
