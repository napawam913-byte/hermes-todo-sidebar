/**
 * 模块用途：验证 renderer 只能通过白名单 IPC 控制桌宠窗口。
 * 模块边界：使用 IPC 与控制器替身，不启动 Electron。
 */
import type { IpcMain } from "electron";
import { describe, expect, it, vi } from "vitest";
import { PET_CHANNELS, registerPetIpc } from "./petIpc.js";
import type { PetWindowController } from "./petWindowController.js";

describe("registerPetIpc", () => {
  it("注册拖动、布局和展开收起白名单", async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const ipc = {
      handle(channel: string, listener: (...args: unknown[]) => unknown) {
        handlers.set(channel, listener);
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

    expect([...handlers.keys()].sort()).toEqual(Object.values(PET_CHANNELS).sort());
    expect(handlers.get(PET_CHANNELS.layout)?.({})).toEqual({ expanded: false });
    expect(handlers.get(PET_CHANNELS.expanded)?.({}, true)).toEqual({ expanded: true });
    expect(handlers.get(PET_CHANNELS.dragStart)?.({})).toBe(true);
    expect(handlers.get(PET_CHANNELS.dragUpdate)?.({})).toEqual({ dragging: true });
    await expect(handlers.get(PET_CHANNELS.dragEnd)?.({})).resolves.toEqual({ dragged: true });
    handlers.get(PET_CHANNELS.dragCancel)?.({});
    expect(controller.cancelDrag).toHaveBeenCalledOnce();
  });
});
