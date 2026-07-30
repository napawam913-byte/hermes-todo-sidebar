/** 模块用途：为 renderer 注册 Plan API 白名单，并转发运行时快照状态。 */
import type { IpcMain } from "electron";
import { parseAppMutationBatch } from "../../shared/appMutationValidation.js";
import type { AppMutationBatch } from "../../shared/appMutationTypes.js";
import type {
  PlanApiConnectionInput,
  PlanApiConnectionTestResult,
  PlanApiMigrationInspection,
  PlanApiPublicConfig,
  PlanApiSnapshotEnvelope,
} from "../../shared/planApiBridgeContract.js";

export const PLAN_API_CHANNELS = {
  load: "plan-api:load-state", execute: "plan-api:execute-mutations", config: "plan-api:get-config",
  test: "plan-api:test-connection", save: "plan-api:save-connection",
  inspectMigration: "plan-api:inspect-migration",
  migrate: "plan-api:migrate", keepRemote: "plan-api:keep-remote",
} as const;
type IpcPort = Pick<IpcMain, "handle" | "removeHandler">;
type Runtime = {
  loadState(): Promise<PlanApiSnapshotEnvelope>; executeMutations(batch: AppMutationBatch): Promise<PlanApiSnapshotEnvelope>;
  getConfig(): Promise<PlanApiPublicConfig>; testConnection(input: PlanApiConnectionInput): Promise<PlanApiConnectionTestResult>;
  saveConnection(input: PlanApiConnectionInput): Promise<PlanApiPublicConfig>;
  inspectMigration(): Promise<PlanApiMigrationInspection>;
  migrateLegacyState(): Promise<PlanApiMigrationInspection>; keepRemoteData(): Promise<PlanApiMigrationInspection>;
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
  ipc.handle(PLAN_API_CHANNELS.test, (_event, input) => runtime.testConnection(parseConnectionInput(input)));
  ipc.handle(PLAN_API_CHANNELS.save, (_event, input) => runtime.saveConnection(parseConnectionInput(input)));
  ipc.handle(PLAN_API_CHANNELS.inspectMigration, () => runtime.inspectMigration());
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

/** 边界：仅接收连接表单的精确公开字段，令牌不会被事件或配置读取接口返回。 */
function parseConnectionInput(value: unknown): PlanApiConnectionInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("连接配置必须是对象");
  const input = value as Record<string, unknown>;
  const keys = ["mode", "baseUrl", "sshTarget", "localPort", "remotePort", "desktopToken"];
  if (Object.keys(input).length !== keys.length || keys.some((key) => !(key in input))) throw new Error("连接配置字段无效");
  if (input.mode !== "local" && input.mode !== "ssh") throw new Error("连接模式无效");
  if (typeof input.baseUrl !== "string") throw new Error("服务地址无效");
  if (typeof input.sshTarget !== "string" || input.mode === "ssh" && !input.sshTarget.trim()) throw new Error("SSH 目标无效");
  if (!port(input.localPort) || !port(input.remotePort)) throw new Error("端口无效");
  if (typeof input.desktopToken !== "string") throw new Error("令牌无效");
  const baseUrl = input.mode === "ssh"
    ? `http://127.0.0.1:${input.localPort}`
    : input.baseUrl;
  if (!validUrl(baseUrl)) throw new Error("服务地址无效");
  return {
    mode: input.mode,
    baseUrl,
    sshTarget: input.sshTarget,
    localPort: input.localPort,
    remotePort: input.remotePort,
    desktopToken: input.desktopToken,
  };
}
function port(value: unknown): value is number { return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 65535; }
function validUrl(value: string): boolean {
  try { const url = new URL(value.trim()); return !!url.hostname && (url.protocol === "http:" || url.protocol === "https:") && !url.username && !url.password; }
  catch { return false; }
}
