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
}

export function createElectronRepositories(
  options: ElectronRepositoryOptions
): ElectronRepositories {
  let serverSnapshot: DomainSnapshot = clone({ todos: options.todos, cyclePlans: options.cyclePlans });
  let desiredSnapshot = clone(serverSnapshot);
  let tail = Promise.resolve();
  const save = (patch: Partial<DomainSnapshot>) => {
    desiredSnapshot = clone({ ...desiredSnapshot, ...patch });
    tail = tail.then(async () => {
      const batch = createSnapshotMutationBatch(serverSnapshot, desiredSnapshot);
      if (!batch) return;
      const snapshot = await options.bridge.executeMutations(batch);
      serverSnapshot = clone({ todos: snapshot.todos as Todo[], cyclePlans: snapshot.cyclePlans as CyclePlan[] });
    }).catch(() => undefined);
  };

  return {
    todoRepository: {
      loadTodos: () => structuredClone(serverSnapshot.todos),
      saveTodos: (todos) => save({ todos })
    },
    cyclePlanRepository: {
      loadPlans: () => structuredClone(serverSnapshot.cyclePlans),
      savePlans: (cyclePlans) => save({ cyclePlans })
    }
  };
}

function clone(snapshot: DomainSnapshot): DomainSnapshot { return structuredClone(snapshot); }
