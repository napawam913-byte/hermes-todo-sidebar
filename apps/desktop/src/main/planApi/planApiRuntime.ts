/** 模块用途：Plan API 的唯一数据端口；旧本地状态只读取界面设置，绝不承接业务写入。 */
import { randomUUID } from "node:crypto";
import type { StoredAppStateV1 } from "../storage/appStateTypes.js";
import type { AppMutationBatch } from "../../shared/appMutationTypes.js";
import type { PlanApiConnectionInput, PlanApiConnectionTestResult, PlanApiPublicConfig, PlanApiRuntimeStatus, PlanApiSnapshotEnvelope } from "../../shared/planApiBridgeContract.js";
import type { PlanApiRuntimeConnection } from "./planApiConnectionStore.js";
import { PlanApiError } from "./planApiErrors.js";
import { PlanApiReconnectLoop } from "./planApiReconnectLoop.js";
import { PlanApiVersionIndex } from "./planApiVersionIndex.js";
import { adaptAppMutationBatch } from "./mutationAdapter.js";
import { mapPlanApiSnapshot } from "./snapshotMapper.js";
import type { PlanApiHealth, PlanApiMutationBatch, PlanApiSnapshot } from "./planApiWireTypes.js";

type Client = { snapshot(): Promise<PlanApiSnapshot>; mutate(batch: PlanApiMutationBatch): Promise<unknown> };
type Cache = { load(): Promise<{ serverRevision: number; syncedAt: string; todos: unknown[]; cyclePlans: unknown[] } | null>; save(value: { schemaVersion: 1; serverRevision: number; syncedAt: string; todos: unknown[]; cyclePlans: unknown[] }): Promise<void> };
type ConnectionStore = { resolveConnection(input?: PlanApiConnectionInput): Promise<PlanApiRuntimeConnection | null>; save(input: PlanApiConnectionInput): Promise<PlanApiPublicConfig> };
type Tunnel = { start(config: { sshTarget: string; localPort: number; remotePort: number }): undefined; stop(): void | Promise<void> };
type LegacyState = { getSnapshot(): StoredAppStateV1 };
type Tester = { test(input: PlanApiConnectionInput): Promise<PlanApiConnectionTestResult> };
export type PlanApiRuntimeListener = (snapshot: PlanApiSnapshotEnvelope) => void;

export interface PlanApiRuntimeDependencies {
  connectionStore: ConnectionStore; cache: Cache; legacyStateService: LegacyState;
  createClient(connection: PlanApiRuntimeConnection): Client; tunnel?: Tunnel;
  connectionTester?: Tester; now?: () => Date;
}

const emptyIndex = () => PlanApiVersionIndex.fromSnapshot({ serverRevision: 0, tasks: [] });
const status = (mode: PlanApiRuntimeStatus["mode"], canMutate: boolean, message: string, cacheAvailable: boolean, serverRevision?: number, lastSyncedAt?: string): PlanApiRuntimeStatus => ({ mode, canMutate, message, cacheAvailable, ...(serverRevision === undefined ? {} : { serverRevision }), ...(lastSyncedAt ? { lastSyncedAt } : {}) });

export class PlanApiRuntime {
  private active = false; private client: Client | null = null; private connection: PlanApiRuntimeConnection | null = null;
  private current: PlanApiSnapshotEnvelope = { todos: [], cyclePlans: [], status: status("unconfigured", false, "数据服务尚未配置", false) };
  private versionIndex = emptyIndex(); private writeTail: Promise<void> = Promise.resolve();
  private readonly listeners = new Set<PlanApiRuntimeListener>(); private readonly now: () => Date;
  private readonly reconnect: PlanApiReconnectLoop; private generation = 0;

  constructor(private readonly deps: PlanApiRuntimeDependencies) {
    this.now = deps.now ?? (() => new Date());
    this.reconnect = new PlanApiReconnectLoop(() => this.refreshForReconnect());
  }

  async initialize(): Promise<PlanApiSnapshotEnvelope> {
    this.active = true; this.reconnect.start();
    await this.configure(await this.deps.connectionStore.resolveConnection());
    return this.getSnapshotEnvelope();
  }
  async saveConnection(input: PlanApiConnectionInput): Promise<PlanApiPublicConfig> {
    const saved = await this.deps.connectionStore.save(input);
    await this.configure(await this.deps.connectionStore.resolveConnection());
    return saved;
  }
  async testConnection(input: PlanApiConnectionInput): Promise<PlanApiConnectionTestResult> {
    if (!this.deps.connectionTester) return { ok: false, message: "连接测试不可用" };
    return this.deps.connectionTester.test(input);
  }
  async refresh(): Promise<PlanApiSnapshotEnvelope> { await this.refreshOnce(true); return this.getSnapshotEnvelope(); }
  async getSnapshotEnvelope(): Promise<PlanApiSnapshotEnvelope> { return structuredClone(this.current); }
  async getStoredSnapshot(): Promise<StoredAppStateV1> {
    const legacy = this.deps.legacyStateService.getSnapshot();
    return { schemaVersion: 1, todos: structuredClone(this.current.todos), cyclePlans: structuredClone(this.current.cyclePlans), settings: structuredClone(legacy.settings), updatedAt: legacy.updatedAt };
  }
  subscribe(listener: PlanApiRuntimeListener): () => void { this.listeners.add(listener); listener(this.getNow()); return () => this.listeners.delete(listener); }
  async shutdown(): Promise<void> { this.generation += 1; this.active = false; this.reconnect.shutdown(); this.client = null; this.connection = null; if (this.deps.tunnel) await this.deps.tunnel.stop(); }

  async execute(batch: AppMutationBatch): Promise<StoredAppStateV1> {
    return this.enqueueWrite(async () => {
      if (!this.current.status.canMutate || !this.client) throw new PlanApiError("offline");
      const client = this.client;
      const idempotencyKey = batch.source.type === "ai_draft" ? batch.source.proposalId : randomUUID();
      const wire = adaptAppMutationBatch({ batch, snapshot: { todos: this.current.todos as never[], cyclePlans: this.current.cyclePlans as never[] }, versionIndex: this.versionIndex, idempotencyKey });
      try { await client.mutate(wire); }
      catch (error) { if (error instanceof PlanApiError && error.code === "version_conflict") await this.refreshOnce(false).catch(() => undefined); throw error; }
      if (!await this.refreshOnce(true)) throw new PlanApiError("offline");
      return this.getStoredSnapshot();
    });
  }

  private async configure(connection: PlanApiRuntimeConnection | null): Promise<void> {
    this.generation += 1; const previous = this.connection; this.connection = connection; this.client = null; this.reconnect.notifyOnline();
    if (previous?.mode === "ssh" && this.deps.tunnel) await this.deps.tunnel.stop();
    if (!connection) { await this.loadCache("unconfigured", "数据服务尚未配置"); return; }
    try {
      if (connection.mode === "ssh" && this.deps.tunnel) this.deps.tunnel.start(connection);
      this.client = this.deps.createClient(connection); this.set({ ...this.current, status: status("connecting", false, "正在连接数据服务", this.current.status.cacheAvailable) });
      await this.refreshOnce(true);
    } catch { await this.loadCache("offline_cache", "数据服务离线，正在显示最近缓存"); this.reconnect.notifyOffline(); }
  }
  private async refreshForReconnect(): Promise<boolean> { return this.refreshOnce(false); }
  private async refreshOnce(scheduleReconnect: boolean): Promise<boolean> {
    const generation = this.generation;
    if (!this.active || !this.client) { await this.loadCache("unconfigured", "数据服务尚未配置"); return false; }
    try {
      const mapped = mapPlanApiSnapshot(await this.client.snapshot()); const syncedAt = this.now().toISOString();
      await this.deps.cache.save({ schemaVersion: 1, serverRevision: mapped.serverRevision, syncedAt, todos: mapped.todos, cyclePlans: mapped.cyclePlans });
      if (!this.active || generation !== this.generation) return false;
      this.versionIndex = mapped.versionIndex; this.set({ todos: mapped.todos, cyclePlans: mapped.cyclePlans, status: status("online", true, "数据服务已连接", true, mapped.serverRevision, syncedAt) }); this.reconnect.notifyOnline(); return true;
    } catch {
      if (!this.active || generation !== this.generation) return false;
      await this.loadCache("offline_cache", "数据服务离线，正在显示最近缓存"); if (scheduleReconnect) this.reconnect.notifyOffline(); return false;
    }
  }
  private async loadCache(mode: "unconfigured" | "offline_cache", message: string): Promise<void> {
    const cached = await this.deps.cache.load();
    if (cached) this.set({ todos: cached.todos, cyclePlans: cached.cyclePlans, status: status("offline_cache", false, message, true, cached.serverRevision, cached.syncedAt) });
    else this.set({ todos: [], cyclePlans: [], status: status(mode === "offline_cache" ? "unconfigured" : mode, false, message, false) });
  }
  private enqueueWrite<T>(operation: () => Promise<T>): Promise<T> { const result = this.writeTail.then(operation); this.writeTail = result.then(() => undefined, () => undefined); return result; }
  private set(snapshot: PlanApiSnapshotEnvelope): void { this.current = structuredClone(snapshot); for (const listener of this.listeners) try { listener(this.getNow()); } catch { /* 订阅者不可影响运行时 */ } }
  private getNow(): PlanApiSnapshotEnvelope { return structuredClone(this.current); }
}
