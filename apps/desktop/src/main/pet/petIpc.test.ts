/**
 * 模块用途：验证 renderer 只能通过白名单 IPC 控制桌宠窗口。
 * 模块边界：使用 IPC 与控制器替身，不启动 Electron。
 */
import type { IpcMain } from "electron";
import { describe, expect, it, vi } from "vitest";
import type {
  PetDragPointerSample,
  PetDragStartSample
} from "../../shared/petDragContract.js";
import { PET_CHANNELS, registerPetIpc } from "./petIpc.js";
import type { PetWindowController } from "./petWindowController.js";

describe("registerPetIpc", () => {
  it("注册拖动、布局和展开收起白名单并转发合法坐标", () => {
    const invokeHandlers = new Map<string, (...args: unknown[]) => unknown>();
    const eventHandlers = new Map<string, (...args: unknown[]) => unknown>();
    const ipc = {
      handle(channel: string, listener: (...args: unknown[]) => unknown) {
        invokeHandlers.set(channel, listener);
      },
      on(channel: string, listener: (...args: unknown[]) => unknown) {
        eventHandlers.set(channel, listener);
      }
    } as unknown as IpcMain;
    const controller = {
      getLayout: vi.fn(() => ({ expanded: false })),
      setExpanded: vi.fn((expanded) => ({ expanded })),
      startDrag: vi.fn(() => true),
      updateDrag: vi.fn(() => ({ dragging: true })),
      endDrag: vi.fn(async () => ({ dragged: true })),
      cancelDrag: vi.fn()
    } as unknown as PetWindowController;

    registerPetIpc(ipc, controller);

    const start: PetDragStartSample = {
      pointerId: 2,
      screenX: 100,
      screenY: 120,
      clientX: 10,
      clientY: 12,
      timeMs: 5
    };
    const point: PetDragPointerSample = {
      pointerId: 2,
      screenX: 140,
      screenY: 150,
      timeMs: 10
    };

    expect(invokeHandlers.get(PET_CHANNELS.layout)?.({})).toEqual({ expanded: false });
    expect(invokeHandlers.get(PET_CHANNELS.expanded)?.({}, true)).toEqual({ expanded: true });
    eventHandlers.get(PET_CHANNELS.dragStart)?.({}, start);
    eventHandlers.get(PET_CHANNELS.dragUpdate)?.({}, point);
    eventHandlers.get(PET_CHANNELS.dragEnd)?.({}, point);
    eventHandlers.get(PET_CHANNELS.dragCancel)?.({}, point.pointerId);

    expect(controller.startDrag).toHaveBeenCalledWith(start);
    expect(controller.updateDrag).toHaveBeenCalledWith(point);
    expect(controller.endDrag).toHaveBeenCalledWith(point);
    expect(controller.cancelDrag).toHaveBeenCalledWith(point.pointerId);
  });

  it("拒绝非法坐标和非法 pointerId", () => {
    const eventHandlers = new Map<string, (...args: unknown[]) => unknown>();
    const ipc = {
      handle: vi.fn(),
      on(channel: string, listener: (...args: unknown[]) => unknown) {
        eventHandlers.set(channel, listener);
      }
    } as unknown as IpcMain;
    const controller = {
      startDrag: vi.fn(),
      updateDrag: vi.fn(),
      endDrag: vi.fn(),
      cancelDrag: vi.fn()
    } as unknown as PetWindowController;

    registerPetIpc(ipc, controller);
    eventHandlers.get(PET_CHANNELS.dragStart)?.({}, {
      pointerId: 1,
      screenX: Number.POSITIVE_INFINITY,
      screenY: 2,
      clientX: 3,
      clientY: 4,
      timeMs: 5
    });
    eventHandlers.get(PET_CHANNELS.dragUpdate)?.({}, { pointerId: 1, screenX: 2 });
    eventHandlers.get(PET_CHANNELS.dragCancel)?.({}, "1");

    expect(controller.startDrag).not.toHaveBeenCalled();
    expect(controller.updateDrag).not.toHaveBeenCalled();
    expect(controller.cancelDrag).not.toHaveBeenCalled();
  });
});
