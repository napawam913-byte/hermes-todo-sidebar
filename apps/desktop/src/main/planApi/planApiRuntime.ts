/** 模块用途：Plan API 的唯一数据端口；旧本地状态仅提供界面设置。 */
import { randomUUID } from "node:crypto";
import type { StoredAppStateV1 } from "../storage/appStateTypes.js";
import type { AppMutationBatch } from "../../shared/appMutationTypes.js";
import type { PlanApiConnectionInput, PlanApiConnectionTestResult, PlanApiPublicConfig } from "../../shared/planApiBridgeContract.js";
import type { PlanApiRuntimeStatus, PlanApiSnapshotEnvelope } from "../../shared/planApiBridgeContract.js";
import type { PlanApiRuntimeConnection } from "./planApiConnectionStore.js";
import { PlanApiError } from "./planApiErrors.js";
import { PlanApiReconnectLoop, type PlanApiReconnectPorts } from "./planApiReconnectLoop.js";
import { PlanApiVersionIndex } from "./planApiVersionIndex.js";
import { adaptAppMutationBatch } from "./mutationAdapter.js";
import { mapPlanApiSnapshot } from "./snapshotMapper.js";
import type { PlanApiMutationBatch, PlanApiSnapshot } from "./planApiWireTypes.js";
type Client = { snapshot(): Promise<PlanApiSnapshot>; mutate(batch: PlanApiMutationBatch): Promise<unknown> };
type CacheValue = { serverRevision: number; syncedAt: string; todos: unknown[]; cyclePlans: unknown[] };
type Cache = { load(): Promise<CacheValue | null>; save(value: CacheValue & { schemaVersion: 1 }): Promise<void> };
type Store = { resolveConnection(input?: PlanApiConnectionInput): Promise<PlanApiRuntimeConnection | null>;
  save(input: PlanApiConnectionInput): Promise<PlanApiPublicConfig> };
type Tunnel = { start(config: { sshTarget: string; localPort: number; remotePort: number }): undefined; stop(): void | Promise<void> };
export type PlanApiRuntimeListener = (snapshot: PlanApiSnapshotEnvelope) => void;
export interface PlanApiRuntimeDependencies {
  connectionStore: Store; cache: Cache; legacyStateService: { getSnapshot(): StoredAppStateV1 };
  createClient(baseUrl: string, token: string): Client; tunnel?: Tunnel;
  connectionTester?: { test(input: PlanApiConnectionInput): Promise<PlanApiConnectionTestResult> };
  reconnectPorts?: PlanApiReconnectPorts; now?: () => Date;
}
const emptyIndex = () => PlanApiVersionIndex.fromSnapshot({ serverRevision: 0, tasks: [] });
const status = (mode: PlanApiRuntimeStatus["mode"], canMutate: boolean, message: string,
  cacheAvailable: boolean, serverRevision?: number, lastSyncedAt?: string): PlanApiRuntimeStatus => ({
  mode, canMutate, message, cacheAvailable,
  ...(serverRevision === undefined ? {} : { serverRevision }),
  ...(lastSyncedAt ? { lastSyncedAt } : {}),
});
const retryable = (error: unknown) => error instanceof PlanApiError
  && (error.code === "offline" || (error.code === "http_error" && (error.status ?? 0) >= 500));
const noWriteRetry = (error: unknown) => error instanceof PlanApiError
  && (["auth_failed", "validation_failed", "version_conflict", "response_invalid"].includes(error.code)
    || (error.code === "http_error" && (error.status ?? 500) < 500));
const errorMessages: Record<PlanApiError["code"], string> = {
  auth_failed: "数据服务认证失败，请检查连接令牌", response_invalid: "数据服务响应无效，请检查服务版本",
  validation_failed: "请求数据无效，请检查后重试", version_conflict: "数据已更新，请刷新后重试",
  offline: "数据服务离线，正在显示最近缓存", http_error: "数据服务请求失败，请稍后重试",
};
const errorMessage = (error: unknown) => error instanceof PlanApiError ? errorMessages[error.code] : "本地缓存不可用，请检查磁盘后重试";
function stableJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") return Number.isFinite(value) ? JSON.stringify(value) : "null";
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (typeof value !== "object") return "null";
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined && typeof item !== "function" && typeof item !== "symbol")
    .sort(([left], [right]) => left.localeCompare(right));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
}
export class PlanApiRuntime {
  private active = false; private generation = 0;
  private client: Client | null = null; private connection: PlanApiRuntimeConnection | null = null;
  private current: PlanApiSnapshotEnvelope = { todos: [], cyclePlans: [], status: status("unconfigured", false, "数据服务尚未配置", false) };
  private versionIndex = emptyIndex();
  private tail: Promise<void> = Promise.resolve();
  private readonly listeners = new Set<PlanApiRuntimeListener>();
  private readonly now: () => Date;
  private readonly reconnect: PlanApiReconnectLoop;
  private readonly pendingManual = new Map<string, string>();
  constructor(private readonly deps: PlanApiRuntimeDependencies) {
    this.now = deps.now ?? (() => new Date());
    this.reconnect = new PlanApiReconnectLoop(() => this.enqueue(() => this.refreshCurrent(false)), deps.reconnectPorts);
  }
  async initialize(): Promise<PlanApiSnapshotEnvelope> {
    this.active = true; this.reconnect.start();
    return this.enqueue(async () => { await this.configure(await this.deps.connectionStore.resolveConnection()); return this.copy(); });
  }
  async saveConnection(input: PlanApiConnectionInput): Promise<PlanApiPublicConfig> {
    return this.enqueue(async () => {
      const saved = await this.deps.connectionStore.save(input);
      await this.configure(await this.deps.connectionStore.resolveConnection()); return saved;
    });
  }
  async testConnection(input: PlanApiConnectionInput): Promise<PlanApiConnectionTestResult> {
    return this.deps.connectionTester?.test(input) ?? { ok: false, message: "连接测试不可用" };
  }
  async refresh(): Promise<PlanApiSnapshotEnvelope> {
    return this.enqueue(async () => { await this.refreshCurrent(true); return this.copy(); });
  }
  async getSnapshotEnvelope(): Promise<PlanApiSnapshotEnvelope> { return this.copy(); }
  async getStoredSnapshot(): Promise<StoredAppStateV1> {
    const legacy = this.deps.legacyStateService.getSnapshot();
    return { schemaVersion: 1, todos: structuredClone(this.current.todos), cyclePlans: structuredClone(this.current.cyclePlans),
      settings: structuredClone(legacy.settings), updatedAt: legacy.updatedAt };
  }
  subscribe(listener: PlanApiRuntimeListener): () => void {
    this.listeners.add(listener);
    try { listener(this.copy()); } catch { /* 订阅者不能影响运行时。 */ }
    return () => this.listeners.delete(listener);
  }
  async shutdown(): Promise<void> {
    this.active = false; this.generation += 1;
    this.client = null; this.connection = null;
    this.reconnect.shutdown();
    this.publish({ ...this.current, status: status("unconfigured", false, "数据服务已关闭", this.current.status.cacheAvailable) });
    await this.enqueue(async () => { await this.deps.tunnel?.stop(); });
  }
  async execute(batch: AppMutationBatch): Promise<StoredAppStateV1> {
    return this.enqueue(async () => {
      const client = this.client; const connection = this.connection; const generation = this.generation;
      if (!this.valid(client, connection, generation) || !this.current.status.canMutate) {
        throw new PlanApiError("offline");
      }
      const manual = batch.source.type === "manual"; const fingerprint = manual ? stableJson(batch.operations) : "";
      const key = batch.source.type === "ai_draft"
        ? batch.source.proposalId : this.pendingManual.get(fingerprint) ?? randomUUID();
      let wire: PlanApiMutationBatch;
      try {
        wire = adaptAppMutationBatch({
          batch,
          snapshot: { todos: this.current.todos as never[], cyclePlans: this.current.cyclePlans as never[] },
          versionIndex: this.versionIndex,
          idempotencyKey: key,
        });
      } catch (error) {
        if (manual) this.pendingManual.delete(fingerprint);
        throw error;
      }
      if (manual) this.pendingManual.set(fingerprint, key);
      try {
        await client.mutate(wire);
        if (!await this.refreshCaptured(client, connection!, generation, true)) throw new PlanApiError("offline");
        if (manual) this.pendingManual.delete(fingerprint);
        return this.getStoredSnapshot();
      } catch (error) {
        if (manual && noWriteRetry(error)) this.pendingManual.delete(fingerprint);
        if (error instanceof PlanApiError && error.code === "version_conflict") {
          await this.refreshCaptured(client, connection!, generation, true);
        }
        throw error;
      }
    });
  }
  private async configure(connection: PlanApiRuntimeConnection | null): Promise<void> {
    if (!this.active) return;
    const previous = this.connection; const generation = ++this.generation;
    this.client = null; this.connection = connection;
    this.reconnect.notifyOnline();
    if (previous?.mode === "ssh") await this.deps.tunnel?.stop();
    if (!connection) return this.fallback(new Error("unconfigured"), generation, "unconfigured");
    if (connection.mode === "ssh" && !this.deps.tunnel) {
      return this.fallback(new Error("ssh tunnel unavailable"), generation);
    }
    if (connection.mode === "ssh") {
      this.deps.tunnel!.start({
        sshTarget: connection.sshTarget, localPort: connection.localPort, remotePort: connection.remotePort,
      });
    }
    const baseUrl = connection.mode === "ssh" ? `http://127.0.0.1:${connection.localPort}` : connection.baseUrl;
    const client = this.deps.createClient(baseUrl, connection.token);
    this.client = client;
    this.publish({
      ...this.current,
      status: status("connecting", false, "正在连接数据服务", this.current.status.cacheAvailable),
    });
    await this.refreshCaptured(client, connection, generation, true);
  }
  private async refreshCurrent(schedule: boolean): Promise<boolean> {
    const client = this.client; const connection = this.connection; const generation = this.generation;
    return this.valid(client, connection, generation)
      ? this.refreshCaptured(client, connection!, generation, schedule)
      : false;
  }
  private async refreshCaptured(
    client: Client, connection: PlanApiRuntimeConnection, generation: number, schedule: boolean,
  ): Promise<boolean> {
    if (!this.valid(client, connection, generation)) return false;
    try {
      const mapped = mapPlanApiSnapshot(await client.snapshot());
      if (!this.valid(client, connection, generation)) return false;
      const syncedAt = this.now().toISOString();
      await this.deps.cache.save({
        schemaVersion: 1, serverRevision: mapped.serverRevision, syncedAt,
        todos: mapped.todos, cyclePlans: mapped.cyclePlans,
      });
      if (!this.valid(client, connection, generation)) return false;
      this.versionIndex = mapped.versionIndex;
      this.publish({
        todos: mapped.todos,
        cyclePlans: mapped.cyclePlans,
        status: status("online", true, "数据服务已连接", true, mapped.serverRevision, syncedAt),
      });
      this.reconnect.notifyOnline();
      return true;
    } catch (error) {
      if (!this.valid(client, connection, generation)) return false;
      await this.fallback(error, generation);
      if (schedule && retryable(error)) this.reconnect.notifyOffline();
      return false;
    }
  }
  private async fallback(
    error: unknown, generation: number, mode: PlanApiRuntimeStatus["mode"] = "offline_cache",
  ): Promise<void> {
    let cached: CacheValue | null = null;
    try { cached = await this.deps.cache.load(); } catch { error = new Error("cache"); }
    if (!this.active || generation !== this.generation) return;
    this.publish({
      todos: cached?.todos ?? this.current.todos,
      cyclePlans: cached?.cyclePlans ?? this.current.cyclePlans,
      status: status(mode, false, errorMessage(error), !!cached, cached?.serverRevision, cached?.syncedAt),
    });
  }
  private valid(client: Client | null, connection: PlanApiRuntimeConnection | null, generation: number): client is Client {
    return this.active && generation === this.generation && client !== null && this.client === client && this.connection === connection;
  }
  private enqueue<T>(job: () => Promise<T>): Promise<T> {
    const result = this.tail.then(job); this.tail = result.then(() => undefined, () => undefined); return result;
  }
  private publish(snapshot: PlanApiSnapshotEnvelope): void {
    this.current = structuredClone(snapshot);
    for (const listener of this.listeners) try { listener(this.copy()); } catch { /* 订阅者不能影响运行时。 */ }
  }
  private copy(): PlanApiSnapshotEnvelope { return structuredClone(this.current); }
}
