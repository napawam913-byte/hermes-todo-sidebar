/**
 * 模块用途：验证 Electron IPC 数据桥可复用现有同步仓储接口。
 * 模块边界：只测试读取初始快照和转发保存，不调用真实 preload。
 */
import { describe, expect, it, vi } from "vitest";
import { mockCyclePlans } from "../features/cyclePlans/mockCyclePlans";
import { mockTodos } from "../features/todos/mockTodos";
import { createElectronRepositories, type DesktopDataBridge } from "./electronRepositories";

describe("createElectronRepositories", () => {
  it("loads the startup snapshot and forwards later saves", () => {
    const bridge: DesktopDataBridge = {
      loadState: vi.fn(),
      replaceTodos: vi.fn(async () => undefined),
      replaceCyclePlans: vi.fn(async () => undefined)
    };
    const repositories = createElectronRepositories({
      bridge,
      todos: mockTodos,
      cyclePlans: mockCyclePlans
    });

    expect(repositories.todoRepository.loadTodos()).toEqual(mockTodos);
    expect(repositories.cyclePlanRepository.loadPlans()).toEqual(mockCyclePlans);

    repositories.todoRepository.saveTodos(mockTodos.slice(0, 1));
    repositories.cyclePlanRepository.savePlans(mockCyclePlans.slice(0, 1));
    expect(bridge.replaceTodos).toHaveBeenCalledWith(mockTodos.slice(0, 1));
    expect(bridge.replaceCyclePlans).toHaveBeenCalledWith(mockCyclePlans.slice(0, 1));
  });
});
