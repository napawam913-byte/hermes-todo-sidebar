/** 模块用途：组合 Plan API 主进程依赖；边界：不向 renderer 暴露令牌、HTTP 或窗口对象。 */
import { safeStorage, type IpcMain } from "electron";
import type { AppMutationBatch } from "../../shared/appMutationTypes.js";
import type {
  PlanApiConnectionInput,
  PlanApiMigrationInspection,
  PlanApiSnapshotEnvelope,
} from "../../shared/planApiBridgeContract.js";
import type { AppStateService } from "../storage/appStateService.js";
import type { StoredAppStateV1 } from "../storage/appStateTypes.js";
import { PlanApiClient } from "./planApiClient.js";
import { PlanApiConnectionFileStore, PlanApiConnectionStore } from "./planApiConnectionStore.js";
import { PlanApiConnectionTester, reservePlanApiTestPort } from "./planApiConnectionTester.js";
import { registerPlanApiIpc } from "./planApiIpc.js";
import { PlanApiMigrationFileStore } from "./planApiMigrationFileStore.js";
import { PlanApiMigrationService } from "./planApiMigrationService.js";
import { PlanApiRuntime } from "./planApiRuntime.js";
import { PlanApiSnapshotCache } from "./planApiSnapshotCache.js";
import { PlanApiSshTunnel, type SshTunnelConfig } from "./planApiSshTunnel.js";

export interface PlanApiBootstrapOptions { ipc: IpcMain; userDataDirectory: string; dataDirectory: string; isPackaged: boolean; legacyStateService: AppStateService; publish(channel: string, payload: unknown): void; }
export interface RegisteredPlanApiRuntime {
  initialize(): Promise<PlanApiSnapshotEnvelope>;
  shutdown(): Promise<void>;
  getStoredSnapshot(): Promise<StoredAppStateV1>;
  execute(batch: AppMutationBatch): Promise<StoredAppStateV1>;
  refresh(): Promise<PlanApiSnapshotEnvelope>;
}

type SnapshotRuntime = Pick<PlanApiRuntime, "getSnapshotEnvelope" | "execute">;
type MigrationServicePort = Pick<
  PlanApiMigrationService,
  "inspect" | "migrate" | "keepRemoteAndSkip"
>;

/** renderer 数据端口始终返回状态信封；AI 仍可单独使用 runtime.execute 的旧状态合同。 */
export function createPlanApiSnapshotPort(runtime: SnapshotRuntime) {
  return {
    loadState: () => runtime.getSnapshotEnvelope(),
    async executeMutations(batch: AppMutationBatch): Promise<PlanApiSnapshotEnvelope> {
      await runtime.execute(batch);
      return runtime.getSnapshotEnvelope();
    },
  };
}

/** 迁移预览严格只读；只有改变迁移决策的动作才刷新运行时快照。 */
export function createPlanApiMigrationPort(
  resolveService: () => Promise<MigrationServicePort>,
  refresh: () => Promise<unknown>,
) {
  const change = async (
    action: (service: MigrationServicePort) => Promise<PlanApiMigrationInspection>,
  ) => {
    const result = await action(await resolveService());
    await refresh();
    return result;
  };
  return {
    inspectMigration: async () => (await resolveService()).inspect(),
    migrateLegacyState: () => change((service) => service.migrate()),
    keepRemoteData: () => change((service) => service.keepRemoteAndSkip()),
  };
}

/** 显式适配同步 start 契约，避免把异步值伪装为 undefined。 */
function tunnelPort(tunnel: PlanApiSshTunnel) {
  return { start(config: SshTunnelConfig): undefined { tunnel.start(config); return undefined; }, stop: () => tunnel.stop() };
}

export function registerPlanApiRuntime(options: PlanApiBootstrapOptions): RegisteredPlanApiRuntime {
  const connections = new PlanApiConnectionStore(new PlanApiConnectionFileStore(options.userDataDirectory), {
    isAvailable: () => safeStorage.isEncryptionAvailable(), encrypt: (value) => safeStorage.encryptString(value), decrypt: (value) => safeStorage.decryptString(value),
  }, undefined, { isPackaged: () => options.isPackaged, get: (name) => process.env[name] });
  const tunnel = new PlanApiSshTunnel();
  const client = (baseUrl: string, token: string) => new PlanApiClient({ baseUrl, token });
  const resolveMigrationService = async () => {
    const connection = await connections.resolveConnection();
    if (!connection) throw new Error("Plan API is not configured");
    const baseUrl = connection.mode === "ssh" ? `http://127.0.0.1:${connection.localPort}` : connection.baseUrl;
    return new PlanApiMigrationService({
      legacyState: options.legacyStateService,
      client: client(baseUrl, connection.token),
      fileStore: new PlanApiMigrationFileStore(options.dataDirectory),
    });
  };
  const runtime = new PlanApiRuntime({
    connectionStore: connections, cache: new PlanApiSnapshotCache(options.dataDirectory), legacyStateService: options.legacyStateService, createClient: client, tunnel: tunnelPort(tunnel),
    migrationInspector: { inspect: async () => (await resolveMigrationService()).inspect() },
    connectionTester: new PlanApiConnectionTester({ resolveConnection: (input) => connections.resolveConnection(input), reservePort: reservePlanApiTestPort, createTunnel: () => tunnelPort(new PlanApiSshTunnel()), createClient: client }),
  });
  const port = {
    ...createPlanApiSnapshotPort(runtime), getConfig: () => connections.getPublicConfig(),
    testConnection: (input: PlanApiConnectionInput) => runtime.testConnection(input), saveConnection: (input: PlanApiConnectionInput) => runtime.saveConnection(input),
    ...createPlanApiMigrationPort(resolveMigrationService, () => runtime.refresh()),
    subscribe: runtime.subscribe.bind(runtime),
  };
  const removeIpc = registerPlanApiIpc(options.ipc, port, options.publish);
  return {
    initialize: () => runtime.initialize(), getStoredSnapshot: () => runtime.getStoredSnapshot(), execute: (batch) => runtime.execute(batch), refresh: () => runtime.refresh(),
    async shutdown() { removeIpc(); await runtime.shutdown(); },
  };
}
