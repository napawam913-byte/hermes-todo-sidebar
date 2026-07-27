/** 模块用途：为 renderer 注册 Plan API 白名单，并转发运行时快照状态。 */
import type { IpcMain } from "electron";
import { parseAppMutationBatch } from "../../shared/appMutationValidation.js";
import type { AppMutationBatch } from "../../shared/appMutationTypes.js";
import type { PlanApiConnectionInput, PlanApiConnectionTestResult, PlanApiPublicConfig, PlanApiSnapshotEnvelope } from "../../shared/planApiBridgeContract.js";
import type { StoredAppStateV1 } from "../storage/appStateTypes.js";

export const PLAN_API_CHANNELS = {
  load: "plan-api:load-state", execute: "plan-api:execute-mutations", config: "plan-api:get-config",
  test: "plan-api:test-connection", save: "plan-api:save-connection", migrate: "plan-api:migrate", keepRemote: "plan-api:keep-remote",
} as const;
type IpcPort = Pick<IpcMain, "handle" | "removeHandler">;
type Runtime = {
  loadState(): Promise<StoredAppStateV1>; executeMutations(batch: AppMutationBatch): Promise<StoredAppStateV1>;
  getConfig(): Promise<PlanApiPublicConfig>; testConnection(input: PlanApiConnectionInput): Promise<PlanApiConnectionTestResult>;
  saveConnection(input: PlanApiConnectionInput): Promise<PlanApiPublicConfig>; migrateLegacyState(): Promise<unknown>; keepRemoteData(): Promise<unknown>;
  subscribe(listener: (snapshot: PlanApiSnapshotEnvelope) => void): () => void;
};
const cleanupByIpc = new WeakMap<object, () => void>();
const channels = Object.values(PLAN_API_CHANNELS);

/** 边界：仅允许公开配置离开主进程，令牌始终留在连接存储与 HTTP 客户端内。 */
export function registerPlanApiIpc(ipc: IpcPort, runtime: Runtime, publish: (channel: string, payload: unknown) => void = () => undefined): () => void {
  cleanupByIpc.get(ipc)?.();
  channels.forEach((channel) => ipc.removeHandler(channel));
  ipc.handle(PLAN_API_CHANNELS.load, () => runtime.loadState());
  ipc.handle(PLAN_API_CHANNELS.execute, (_event, batch) => runtime.executeMutations(parseAppMutationBatch(batch)));
  ipc.handle(PLAN_API_CHANNELS.config, () => runtime.getConfig());
  ipc.handle(PLAN_API_CHANNELS.test, (_event, input) => runtime.testConnection(input as PlanApiConnectionInput));
  ipc.handle(PLAN_API_CHANNELS.save, (_event, input) => runtime.saveConnection(input as PlanApiConnectionInput));
  ipc.handle(PLAN_API_CHANNELS.migrate, () => runtime.migrateLegacyState());
  ipc.handle(PLAN_API_CHANNELS.keepRemote, () => runtime.keepRemoteData());
  const unsubscribe = runtime.subscribe((snapshot) => { publish("plan-api:snapshot-changed", snapshot); publish("plan-api:status-changed", snapshot.status); });
  const cleanup = () => {
    if (cleanupByIpc.get(ipc) !== cleanup) return;
    cleanupByIpc.delete(ipc); unsubscribe(); channels.forEach((channel) => ipc.removeHandler(channel));
  };
  cleanupByIpc.set(ipc, cleanup);
  return cleanup;
}
