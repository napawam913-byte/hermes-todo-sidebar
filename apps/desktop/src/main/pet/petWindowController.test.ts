/**
 * 模块用途：验证桌宠窗口编排、跨屏拖动和一次性位置保存。
 * 模块边界：使用端口替身，不创建真实 BrowserWindow 或 Electron screen。
 */
import { describe, expect, it, vi } from "vitest";
import type {
  PetDragPointerSample,
  PetDragStartSample
} from "../../shared/petDragContract.js";
import { PetWindowController, type PetScreenPort, type PetWindowPort } from "./petWindowController.js";

const displays = [
  { id: 1, workArea: { x: 0, y: 0, width: 1707, height: 1019 } },
  { id: 2, workArea: { x: 1707, y: 0, width: 720, height: 1232 } }
];

function createHarness(saved?: { displayId: number; x: number; y: number }) {
  let activeDisplays = displays;
  const bounds: Array<{ x: number; y: number; width: number; height: number }> = [];
  const snapshots: unknown[] = [];
  const save = vi.fn(async () => undefined);
  const windowPort: PetWindowPort = {
    setBounds: (next) => bounds.push(next),
    sendLayout: (snapshot) => snapshots.push(snapshot)
  };
  const screenPort: PetScreenPort = {
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
    setDisplays: (next: typeof displays) => { activeDisplays = next; }
  };
}

const dragStart: PetDragStartSample = {
  pointerId: 5,
  screenX: 1600,
  screenY: 900,
  clientX: 5,
  clientY: 1,
  timeMs: 10
};

function dragPoint(
  screenX: number,
  screenY: number,
  timeMs = 20,
  pointerId = dragStart.pointerId
): PetDragPointerSample {
  return { pointerId, screenX, screenY, timeMs };
}

describe("PetWindowController", () => {
  it("没有有效 move 时按点击结束且不保存位置", async () => {
    const harness = createHarness();
    await harness.controller.initialize();

    expect(harness.controller.startDrag(dragStart)).toBe(true);
    expect(harness.controller.isDragActive()).toBe(true);
    await expect(harness.controller.endDrag(dragPoint(1603, 903))).resolves.toEqual({
      dragged: false
    });
    expect(harness.controller.isDragActive()).toBe(false);
    expect(harness.save).not.toHaveBeenCalled();
  });

  it("跨到副屏拖动后应用最终坐标并只保存一次", async () => {
    const harness = createHarness();
    await harness.controller.initialize();
    harness.controller.startDrag(dragStart);

    expect(harness.controller.updateDrag(dragPoint(1800, 900))).toEqual({
      dragging: true
    });
    expect(harness.save).not.toHaveBeenCalled();
    await expect(harness.controller.endDrag(dragPoint(1815, 910, 30))).resolves.toEqual({
      dragged: true
    });
    expect(harness.save).toHaveBeenCalledTimes(1);
    expect(harness.save).toHaveBeenCalledWith({ displayId: 2, x: 1810, y: 909 });
  });

  it("松手时保持贴边位置而不额外吸附 8px", async () => {
    const harness = createHarness();
    await harness.controller.initialize();
    harness.controller.startDrag(dragStart);
    const edgePoint = dragPoint(1712, 900);

    harness.controller.updateDrag(edgePoint);
    await harness.controller.endDrag(edgePoint);

    expect(harness.bounds.at(-1)).toEqual({ x: 1707, y: 899, width: 88, height: 96 });
    expect(harness.save).toHaveBeenCalledWith({ displayId: 2, x: 1707, y: 899 });
  });

  it("忽略旧 pointer 并在取消时恢复原位置", async () => {
    const harness = createHarness();
    await harness.controller.initialize();
    harness.controller.startDrag(dragStart);

    expect(harness.controller.updateDrag(dragPoint(1800, 900, 20, 99))).toEqual({
      dragging: false
    });
    harness.controller.updateDrag(dragPoint(1800, 900));
    harness.controller.cancelDrag(dragStart.pointerId);

    expect(harness.bounds.at(-1)).toEqual({ x: 1595, y: 899, width: 88, height: 96 });
    expect(harness.save).not.toHaveBeenCalled();
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
