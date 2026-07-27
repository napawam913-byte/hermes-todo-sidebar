/**
 * 模块用途：为 Electron 与浏览器预览提供同形的应用变更执行接口。
 * 模块边界：只返回已持久化快照，不管理 React 状态或模型会话。
 */
import type { CyclePlan, Todo } from "../../shared/appDomainTypes";
import type { AppMutationBatch } from "../../shared/appMutationTypes";
import { parseAppMutationBatch } from "../../shared/appMutationValidation";
import type {
  PlanApiRuntimeStatus,
  PlanApiSnapshotEnvelope
} from "../../shared/planApiBridgeContract";
import { applyBrowserMutationBatch } from "./appMutationState";

export const BROWSER_APP_STATE_KEY = "hermes.todoSidebar.state.v1";
export const OFFLINE_MUTATION_MESSAGE = "数据服务离线，当前仅可查看";

export interface AppMutationSnapshot {
  todos: Todo[];
  cyclePlans: CyclePlan[];
}

export interface AppMutationGateway {
  execute(batch: AppMutationBatch): Promise<AppMutationSnapshot>;
  canMutate(): boolean;
}

interface ElectronMutationBridge {
  executeMutations(batch: AppMutationBatch): Promise<PlanApiSnapshotEnvelope>;
}

interface BrowserStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface BrowserGatewayOptions {
  initialState: AppMutationSnapshot;
  storage?: BrowserStorage;
  now?: () => Date;
  idFactory?: (prefix: string) => string;
}

export function createElectronMutationGateway(
  bridge: ElectronMutationBridge,
  readStatus: () => PlanApiRuntimeStatus
): AppMutationGateway {
  const canMutate = () => readStatus().canMutate;
  return {
    canMutate,
    execute: async (batch) => {
      if (!canMutate()) throw new Error(OFFLINE_MUTATION_MESSAGE);
      return normalizeSnapshot(await bridge.executeMutations(batch));
    }
  };
}

export function createBrowserMutationGateway(
  options: BrowserGatewayOptions
): AppMutationGateway {
  let state = structuredClone(options.initialState);
  const now = options.now ?? (() => new Date());
  const idFactory = options.idFactory ?? defaultIdFactory;

  return {
    canMutate: () => true,
    execute: async (batch) => {
      const parsedBatch = parseAppMutationBatch(batch);
      const next = applyBrowserMutationBatch(state, parsedBatch, {
        now: now().toISOString(),
        idFactory
      });
      options.storage?.setItem(BROWSER_APP_STATE_KEY, JSON.stringify(next));
      state = structuredClone(next);
      return structuredClone(state);
    }
  };
}

export function loadBrowserMutationSnapshot(
  storage: BrowserStorage | undefined
): AppMutationSnapshot | null {
  try {
    const raw = storage?.getItem(BROWSER_APP_STATE_KEY);
    if (!raw) return null;
    return normalizeSnapshot(JSON.parse(raw));
  } catch {
    return null;
  }
}

function normalizeSnapshot(
  value: Pick<PlanApiSnapshotEnvelope, "todos" | "cyclePlans">
): AppMutationSnapshot {
  return {
    todos: value.todos as Todo[],
    cyclePlans: value.cyclePlans as CyclePlan[]
  };
}

function defaultIdFactory(prefix: string): string {
  const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random()}`;
  return `${prefix}_${id}`;
}
