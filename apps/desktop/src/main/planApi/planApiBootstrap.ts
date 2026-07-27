/** 模块用途：组合 Plan API 主进程依赖；边界：不向 renderer 暴露令牌、HTTP 或窗口对象。 */
import { safeStorage, type IpcMain } from "electron";
import type { AppMutationBatch } from "../../shared/appMutationTypes.js";
import type { PlanApiConnectionInput, PlanApiSnapshotEnvelope } from "../../shared/planApiBridgeContract.js";
import type { AppStateService } from "../storage/appStateService.js";
import { PlanApiClient } from "./planApiClient.js";
import { PlanApiConnectionFileStore, PlanApiConnectionStore } from "./planApiConnectionStore.js";
import { PlanApiConnectionTester, reservePlanApiTestPort } from "./planApiConnectionTester.js";
import { registerPlanApiIpc } from "./planApiIpc.js";
import { PlanApiMigrationFileStore } from "./planApiMigrationFileStore.js";
import { PlanApiMigrationService } from "./planApiMigrationService.js";
import type { PlanApiMigrationInspection } from "./planApiMigrationService.js";
import { PlanApiRuntime } from "./planApiRuntime.js";
import { PlanApiSnapshotCache } from "./planApiSnapshotCache.js";
import { PlanApiSshTunnel, type SshTunnelConfig } from "./planApiSshTunnel.js";

export interface PlanApiBootstrapOptions { ipc: IpcMain; userDataDirectory: string; dataDirectory: string; isPackaged: boolean; legacyStateService: AppStateService; publish(channel: string, payload: unknown): void; }
export interface RegisteredPlanApiRuntime {
  initialize(): Promise<PlanApiSnapshotEnvelope>; shutdown(): Promise<void>; getStoredSnapshot(): Promise<ReturnType<AppStateService["getSnapshot"]>>;
  execute(batch: AppMutationBatch): Promise<ReturnType<AppStateService["getSnapshot"]>>; refresh(): Promise<PlanApiSnapshotEnvelope>;
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
  const runtime = new PlanApiRuntime({
    connectionStore: connections, cache: new PlanApiSnapshotCache(options.dataDirectory), legacyStateService: options.legacyStateService, createClient: client, tunnel: tunnelPort(tunnel),
    connectionTester: new PlanApiConnectionTester({ resolveConnection: (input) => connections.resolveConnection(input), reservePort: reservePlanApiTestPort, createTunnel: () => tunnelPort(new PlanApiSshTunnel()), createClient: client }),
  });
  const migration = async (run: (service: PlanApiMigrationService) => Promise<PlanApiMigrationInspection>) => {
    const connection = await connections.resolveConnection();
    if (!connection) throw new Error("Plan API is not configured");
    const baseUrl = connection.mode === "ssh" ? `http://127.0.0.1:${connection.localPort}` : connection.baseUrl;
    const result = await run(new PlanApiMigrationService({ legacyState: options.legacyStateService, client: client(baseUrl, connection.token), fileStore: new PlanApiMigrationFileStore(options.dataDirectory) }));
    await runtime.refresh(); return result;
  };
  const port = {
    loadState: () => runtime.getStoredSnapshot(), executeMutations: (batch: AppMutationBatch) => runtime.execute(batch), getConfig: () => connections.getPublicConfig(),
    testConnection: (input: PlanApiConnectionInput) => runtime.testConnection(input), saveConnection: (input: PlanApiConnectionInput) => runtime.saveConnection(input),
    migrateLegacyState: () => migration((service) => service.migrate()), keepRemoteData: () => migration((service) => service.keepRemoteAndSkip()), subscribe: runtime.subscribe.bind(runtime),
  };
  const removeIpc = registerPlanApiIpc(options.ipc, port, options.publish);
  return {
    initialize: () => runtime.initialize(), getStoredSnapshot: () => runtime.getStoredSnapshot(), execute: (batch) => runtime.execute(batch), refresh: () => runtime.refresh(),
    async shutdown() { removeIpc(); await runtime.shutdown(); },
  };
}
