/**
 * 模块用途：把 preload 的异步数据桥包装成现有同步仓储接口，供 React store 复用。
 * 模块边界：只缓存启动快照并转发保存，不访问文件系统，也不负责领域数据校验。
 */
import type { CyclePlanRepository } from "../features/cyclePlans/cyclePlanRepository";
import type { CyclePlan } from "../features/cyclePlans/cyclePlanTypes";
import type { TodoRepository } from "../features/todos/todoRepository";
import type { Todo } from "../features/todos/types";

export interface DesktopStateSnapshot {
  todos: unknown[];
  cyclePlans: unknown[];
}

export interface DesktopDataBridge {
  loadState(): Promise<DesktopStateSnapshot>;
  replaceTodos(todos: unknown[]): Promise<unknown>;
  replaceCyclePlans(cyclePlans: unknown[]): Promise<unknown>;
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
  const initialTodos = structuredClone(options.todos);
  const initialCyclePlans = structuredClone(options.cyclePlans);

  return {
    todoRepository: {
      loadTodos: () => structuredClone(initialTodos),
      saveTodos: (todos) => {
        void options.bridge.replaceTodos(todos).catch(() => undefined);
      }
    },
    cyclePlanRepository: {
      loadPlans: () => structuredClone(initialCyclePlans),
      savePlans: (plans) => {
        void options.bridge.replaceCyclePlans(plans).catch(() => undefined);
      }
    }
  };
}
