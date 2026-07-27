/**
 * 模块用途：注册 renderer 可调用的应用状态 IPC 白名单。
 * 模块边界：只转发完整快照读取和两个状态切片替换，不暴露文件路径或文件系统能力。
 */
import type { IpcMain } from "electron";
import { parseAppMutationBatch } from "../../shared/appMutationValidation.js";
import { AppMutationExecutor } from "./appMutationExecutor.js";
import type { AppStateService } from "./appStateService.js";

export const STORAGE_CHANNELS = {
  load: "data:load-state",
  // [待删除-2026-07-15] 旧数组替换通道仅为旧 renderer store 兼容保留。
  replaceTodos: "data:replace-todos",
  replaceCyclePlans: "data:replace-cycle-plans",
  executeMutations: "data:execute-mutations"
} as const;

export function registerStorageIpc(
  ipc: IpcMain,
  service: AppStateService,
  executor = new AppMutationExecutor(service)
): void {
  ipc.handle(STORAGE_CHANNELS.load, async () => service.getSnapshot());
  ipc.handle(STORAGE_CHANNELS.replaceTodos, async (_event, todos: unknown[]) =>
    service.replaceTodos(todos)
  );
  ipc.handle(
    STORAGE_CHANNELS.replaceCyclePlans,
    async (_event, cyclePlans: unknown[]) => service.replaceCyclePlans(cyclePlans)
  );
  ipc.handle(STORAGE_CHANNELS.executeMutations, async (_event, request) =>
    executor.execute(parseAppMutationBatch(request))
  );
}
