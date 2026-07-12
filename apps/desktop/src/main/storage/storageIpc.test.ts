/**
 * 模块用途：验证 renderer 只能通过白名单 IPC 读取和替换应用状态切片。
 * 模块边界：使用轻量 IPC 注册器替身，不启动 Electron 窗口。
 */
import type { IpcMain } from "electron";
import { describe, expect, it, vi } from "vitest";
import type { AppStateService } from "./appStateService.js";
import { registerStorageIpc, STORAGE_CHANNELS } from "./storageIpc.js";

describe("registerStorageIpc", () => {
  it("registers load and slice replacement handlers", async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const ipc = {
      handle(channel: string, listener: (...args: unknown[]) => unknown) {
        handlers.set(channel, listener);
      }
    } as unknown as IpcMain;
    const service = {
      getSnapshot: vi.fn(() => ({ schemaVersion: 1 })),
      replaceTodos: vi.fn(async (todos) => ({ todos })),
      replaceCyclePlans: vi.fn(async (cyclePlans) => ({ cyclePlans }))
    } as unknown as AppStateService;

    registerStorageIpc(ipc, service);

    await expect(handlers.get(STORAGE_CHANNELS.load)?.({})).resolves.toEqual({
      schemaVersion: 1
    });
    await handlers.get(STORAGE_CHANNELS.replaceTodos)?.({}, [{ id: "todo_1" }]);
    await handlers.get(STORAGE_CHANNELS.replaceCyclePlans)?.({}, [{ id: "plan_1" }]);
    expect(service.replaceTodos).toHaveBeenCalledWith([{ id: "todo_1" }]);
    expect(service.replaceCyclePlans).toHaveBeenCalledWith([{ id: "plan_1" }]);
  });
});
