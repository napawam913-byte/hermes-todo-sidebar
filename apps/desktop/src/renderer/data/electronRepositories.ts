/**
 * 模块用途：把 preload 的异步数据桥包装成现有同步仓储接口，供 React store 复用。
 * 模块边界：只缓存启动快照并转发保存，不访问文件系统，也不负责领域数据校验。
 */
import type { CyclePlanRepository } from "../features/cyclePlans/cyclePlanRepository";
import type { CyclePlan } from "../features/cyclePlans/cyclePlanTypes";
import type { TodoRepository } from "../features/todos/todoRepository";
import type { Todo } from "../features/todos/types";
import type { AppMutationBatch } from "../../shared/appMutationTypes";
import { createSnapshotMutationBatch, type DomainSnapshot } from "./electronMutationDiff";

export interface DesktopStateSnapshot {
  todos: unknown[];
  cyclePlans: unknown[];
}

export interface DesktopDataBridge {
  loadState(): Promise<DesktopStateSnapshot>;
  executeMutations(batch: AppMutationBatch): Promise<DesktopStateSnapshot>;
}

interface ElectronRepositoryOptions {
  bridge: DesktopDataBridge;
  todos: Todo[];
  cyclePlans: CyclePlan[];
}

export interface ElectronRepositories {
  todoRepository: TodoRepository;
  cyclePlanRepository: CyclePlanRepository;
  getWriteState(): RepositoryWriteState;
  onWriteStateChanged(listener: (state: RepositoryWriteState) => void): () => void;
  retryPending(): void;
}

export type RepositoryWriteState = Readonly<{ pending: boolean; error?: string; }>;
export interface RepositoryWriteController {
  getWriteState(): RepositoryWriteState;
  onWriteStateChanged(listener: (state: RepositoryWriteState) => void): () => void;
  retryPending(): void;
}

export function createElectronRepositories(
  options: ElectronRepositoryOptions
): ElectronRepositories {
  let serverSnapshot: DomainSnapshot = clone({ todos: options.todos, cyclePlans: options.cyclePlans });
  let desiredSnapshot = clone(serverSnapshot);
  let tail = Promise.resolve();
  let retryRequired = false;
  let writeState: RepositoryWriteState = Object.freeze({ pending: false });
  const listeners = new Set<(state: RepositoryWriteState) => void>();
  const publish = (state: RepositoryWriteState) => {
    writeState = Object.freeze({ ...state });
    listeners.forEach((listener) => listener(writeState));
  };
  const schedule = () => {
    publish({ pending: true });
    tail = tail.then(flush, flush);
  };
  const save = (patch: Partial<DomainSnapshot>) => {
    desiredSnapshot = clone({ ...desiredSnapshot, ...patch });
    retryRequired = false;
    schedule();
  };
  const flush = async () => {
    if (retryRequired) return;
    const desired = clone(desiredSnapshot);
    const batch = createSnapshotMutationBatch(serverSnapshot, desired);
    if (!batch) { publish({ pending: false }); return; }
    try {
      const snapshot = await options.bridge.executeMutations(batch);
      serverSnapshot = clone({ todos: snapshot.todos as Todo[], cyclePlans: snapshot.cyclePlans as CyclePlan[] });
      if (sameSnapshot(desiredSnapshot, desired)) desiredSnapshot = clone(serverSnapshot);
      publish({ pending: !sameSnapshot(desiredSnapshot, serverSnapshot) });
    } catch (error) {
      retryRequired = true;
      publish({ pending: false, error: message(error) });
    }
  };

  return {
    todoRepository: {
      loadTodos: () => structuredClone(serverSnapshot.todos),
      saveTodos: (todos) => save({ todos })
    },
    cyclePlanRepository: {
      loadPlans: () => structuredClone(serverSnapshot.cyclePlans),
      savePlans: (cyclePlans) => save({ cyclePlans })
    },
    getWriteState: () => writeState,
    onWriteStateChanged: (listener) => {
      listeners.add(listener); listener(writeState);
      return () => listeners.delete(listener);
    },
    retryPending: () => { if (retryRequired) { retryRequired = false; schedule(); } }
  };
}

function clone(snapshot: DomainSnapshot): DomainSnapshot { return structuredClone(snapshot); }
function sameSnapshot(left: DomainSnapshot, right: DomainSnapshot): boolean { return JSON.stringify(left) === JSON.stringify(right); }
function message(error: unknown): string { return error instanceof Error ? error.message : "保存到 Plan API 失败"; }
