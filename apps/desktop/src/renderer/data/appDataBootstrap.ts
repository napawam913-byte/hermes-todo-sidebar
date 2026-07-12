/**
 * 模块用途：在应用启动时选择 Electron 文件状态或浏览器 Demo 数据源。
 * 模块边界：只组装初始数据与仓储，不挂载 React，也不处理窗口生命周期。
 */
import {
  createLocalCyclePlanRepository,
  normalizeCyclePlans,
  type StorageLike
} from "../features/cyclePlans/localCyclePlanRepository";
import type { CyclePlanRepository } from "../features/cyclePlans/cyclePlanRepository";
import type { CyclePlan } from "../features/cyclePlans/cyclePlanTypes";
import { mockCyclePlans } from "../features/cyclePlans/mockCyclePlans";
import { createLocalTodoRepository, normalizeTodos } from "../features/todos/localTodoRepository";
import { mockTodos } from "../features/todos/mockTodos";
import type { TodoRepository } from "../features/todos/todoRepository";
import type { Todo } from "../features/todos/types";
import { createElectronRepositories, type DesktopDataBridge } from "./electronRepositories";

export interface AppDataBootstrapResult {
  todoRepository: TodoRepository;
  cyclePlanRepository: CyclePlanRepository;
  initialTodos: Todo[];
  initialCyclePlans: CyclePlan[];
  startExpanded: boolean;
}

interface BootstrapOptions {
  bridge?: DesktopDataBridge;
  storage?: StorageLike;
}

export async function bootstrapAppData(
  options: BootstrapOptions = {}
): Promise<AppDataBootstrapResult> {
  const bridge = options.bridge ?? getDesktopBridge();
  if (bridge) {
    const snapshot = await loadDesktopSnapshot(bridge);
    const initialTodos = normalizeTodos(snapshot.todos);
    const initialCyclePlans = normalizeCyclePlans(snapshot.cyclePlans);
    const repositories = createElectronRepositories({
      bridge,
      todos: initialTodos,
      cyclePlans: initialCyclePlans
    });
    return {
      ...repositories,
      initialTodos,
      initialCyclePlans,
      startExpanded: false
    };
  }

  const storage = options.storage ?? getBrowserStorage();
  const todoRepository = createLocalTodoRepository(storage);
  const cyclePlanRepository = createLocalCyclePlanRepository(storage);
  const persistedTodos = todoRepository.loadTodos();
  const persistedPlans = cyclePlanRepository.loadPlans();
  return {
    todoRepository,
    cyclePlanRepository,
    initialTodos: persistedTodos.length > 0 ? persistedTodos : mockTodos,
    initialCyclePlans: persistedPlans.length > 0 ? persistedPlans : mockCyclePlans,
    startExpanded: true
  };
}

async function loadDesktopSnapshot(bridge: DesktopDataBridge) {
  try {
    return await bridge.loadState();
  } catch {
    return { todos: [], cyclePlans: [] };
  }
}

function getDesktopBridge(): DesktopDataBridge | undefined {
  return typeof window === "undefined" ? undefined : window.hermesAppData;
}

function getBrowserStorage(): StorageLike | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
