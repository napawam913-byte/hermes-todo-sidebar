/**
 * 模块用途：初始化 Plan API 快照或浏览器 Demo，并组装统一变更网关。
 * 模块边界：不挂载 React，不访问主进程实现，也不维护页面会话状态。
 */
import type { CyclePlan, DataSource, Todo } from "../../shared/appDomainTypes";
import type { AppMutationBatch } from "../../shared/appMutationTypes";
import type {
  PlanApiConnectionInput,
  PlanApiConnectionTestResult,
  PlanApiMigrationInspection,
  PlanApiPublicConfig,
  PlanApiRuntimeStatus,
  PlanApiSnapshotEnvelope
} from "../../shared/planApiBridgeContract";
import {
  createLocalCyclePlanRepository,
  normalizeCyclePlans,
  type StorageLike
} from "../features/cyclePlans/localCyclePlanRepository";
import { mockCyclePlans } from "../features/cyclePlans/mockCyclePlans";
import { createLocalTodoRepository, normalizeTodos } from "../features/todos/localTodoRepository";
import { mockTodos } from "../features/todos/mockTodos";
import {
  createBrowserMutationGateway,
  createElectronMutationGateway,
  loadBrowserMutationSnapshot,
  type AppMutationGateway
} from "./appMutationGateway";

export interface PlanApiRendererBridge {
  loadState(): Promise<PlanApiSnapshotEnvelope>;
  executeMutations(batch: AppMutationBatch): Promise<PlanApiSnapshotEnvelope>;
  onSnapshotChanged(listener: (snapshot: PlanApiSnapshotEnvelope) => void): () => void;
  getConfig(): Promise<PlanApiPublicConfig>;
  testConnection(input: PlanApiConnectionInput): Promise<PlanApiConnectionTestResult>;
  saveConnection(input: PlanApiConnectionInput): Promise<PlanApiPublicConfig>;
  inspectMigration(): Promise<PlanApiMigrationInspection>;
  migrateLegacyState(): Promise<PlanApiMigrationInspection>;
  keepRemoteData(): Promise<PlanApiMigrationInspection>;
  onStatusChanged(listener: (status: PlanApiRuntimeStatus) => void): () => void;
}

export interface AppDataBootstrapResult {
  initialTodos: Todo[];
  initialCyclePlans: CyclePlan[];
  initialDataStatus: PlanApiRuntimeStatus;
  mutationGateway: AppMutationGateway;
  planApiBridge: PlanApiRendererBridge | null;
  startExpanded: boolean;
}

interface BootstrapOptions {
  bridge?: PlanApiRendererBridge;
  storage?: StorageLike;
}

const browserStatus: PlanApiRuntimeStatus = {
  mode: "online",
  canMutate: true,
  message: "浏览器预览数据",
  cacheAvailable: false
};

export async function bootstrapAppData(
  options: BootstrapOptions = {}
): Promise<AppDataBootstrapResult> {
  const bridge = options.bridge ?? getRendererBridge();
  if (bridge) return bootstrapElectron(bridge);
  return bootstrapBrowser(options.storage ?? getBrowserStorage());
}

async function bootstrapElectron(
  bridge: PlanApiRendererBridge
): Promise<AppDataBootstrapResult> {
  const snapshot = await bridge.loadState();
  const tracked = createTrackedBridge(bridge, snapshot.status);
  return {
    initialTodos: normalizeMutationTodos(snapshot.todos),
    initialCyclePlans: normalizeCyclePlans(snapshot.cyclePlans),
    initialDataStatus: snapshot.status,
    mutationGateway: createElectronMutationGateway(tracked.bridge, tracked.readStatus),
    planApiBridge: tracked.bridge,
    startExpanded: false
  };
}

function bootstrapBrowser(storage: StorageLike | undefined): AppDataBootstrapResult {
  const todoRepository = createLocalTodoRepository(storage);
  const planRepository = createLocalCyclePlanRepository(storage);
  const unified = loadBrowserMutationSnapshot(storage);
  const storedTodos = unified?.todos ?? todoRepository.loadTodos();
  const storedPlans = unified?.cyclePlans ?? planRepository.loadPlans();
  const initialTodos = storedTodos.length
    ? normalizeMutationTodos(storedTodos)
    : normalizeMutationTodos(mockTodos);
  const initialCyclePlans = storedPlans.length ? normalizeCyclePlans(storedPlans) : mockCyclePlans;
  return {
    initialTodos,
    initialCyclePlans,
    initialDataStatus: browserStatus,
    mutationGateway: createBrowserMutationGateway({
      initialState: { todos: initialTodos, cyclePlans: initialCyclePlans },
      storage
    }),
    planApiBridge: null,
    startExpanded: true
  };
}

/** 兼容旧 renderer Todo：统一网关要求持久化来源，缺失时迁移为 manual。 */
function normalizeMutationTodos(value: unknown): Todo[] {
  return normalizeTodos(value).map((todo) => ({
    ...todo,
    source: normalizeSource((todo as { source?: unknown }).source)
  }));
}

function normalizeSource(value: unknown): DataSource {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { type: "manual" };
  }
  const source = value as Record<string, unknown>;
  const type = source.type;
  if (type !== "manual" && type !== "ai_draft" && type !== "hermes" && type !== "feishu") {
    return { type: "manual" };
  }
  return {
    type,
    ...(typeof source.proposalId === "string" ? { proposalId: source.proposalId } : {}),
    ...(typeof source.externalId === "string" ? { externalId: source.externalId } : {})
  };
}

function createTrackedBridge(
  bridge: PlanApiRendererBridge,
  initialStatus: PlanApiRuntimeStatus
) {
  let status = initialStatus;
  const capture = (snapshot: PlanApiSnapshotEnvelope) => {
    status = snapshot.status;
    return snapshot;
  };
  const tracked: PlanApiRendererBridge = {
    ...bridge,
    loadState: async () => capture(await bridge.loadState()),
    executeMutations: async (batch) => capture(await bridge.executeMutations(batch)),
    onSnapshotChanged: (listener) => bridge.onSnapshotChanged((snapshot) => {
      listener(capture(snapshot));
    }),
    onStatusChanged: (listener) => bridge.onStatusChanged((next) => {
      status = next;
      listener(next);
    })
  };
  return { bridge: tracked, readStatus: () => status };
}

function getRendererBridge(): PlanApiRendererBridge | undefined {
  if (typeof window === "undefined") return undefined;
  const data = window.hermesAppData;
  const planApi = window.hermesPlanApi;
  if (!data && !planApi) return undefined;
  if (!data || !planApi) throw new Error("Plan API renderer bridge is incomplete");
  return { ...data, ...planApi };
}

function getBrowserStorage(): StorageLike | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
