/**
 * 模块用途：验证桌面 Plan API 与浏览器 Demo 的启动合同。
 * 模块边界：只测试初始快照、运行状态和写入入口，不挂载 React。
 */
import { describe, expect, it, vi } from "vitest";
import type { PlanApiRuntimeStatus } from "../../shared/planApiBridgeContract";
import { mockCyclePlans } from "../features/cyclePlans/mockCyclePlans";
import { mockTodos } from "../features/todos/mockTodos";
import {
  bootstrapAppData,
  type PlanApiRendererBridge
} from "./appDataBootstrap";

const offlineStatus: PlanApiRuntimeStatus = {
  mode: "offline_cache",
  canMutate: false,
  message: "数据服务离线，当前仅可查看",
  cacheAvailable: true,
  serverRevision: 7
};

function desktopBridge(
  loadState: PlanApiRendererBridge["loadState"]
): PlanApiRendererBridge {
  return {
    loadState,
    executeMutations: vi.fn(),
    onSnapshotChanged: vi.fn(() => () => undefined),
    getConfig: vi.fn(),
    testConnection: vi.fn(),
    saveConnection: vi.fn(),
    inspectMigration: vi.fn(),
    migrateLegacyState: vi.fn(),
    keepRemoteData: vi.fn(),
    onStatusChanged: vi.fn(() => () => undefined)
  };
}

describe("bootstrapAppData", () => {
  it("keeps the offline cache status and cached Electron rows", async () => {
    const legacyTodo = { ...mockTodos[0] } as Record<string, unknown>;
    delete legacyTodo.date;
    const bridge = desktopBridge(vi.fn(async () => ({
      todos: [legacyTodo, { broken: true }],
      cyclePlans: [mockCyclePlans[0], { broken: true }],
      status: offlineStatus
    })));

    const result = await bootstrapAppData({ bridge });

    expect(result.initialTodos).toHaveLength(1);
    expect(result.initialTodos[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.initialTodos[0].source).toEqual({ type: "manual" });
    expect(result.initialCyclePlans).toEqual([mockCyclePlans[0]]);
    expect(result.initialDataStatus).toEqual(offlineStatus);
    expect(result.mutationGateway.canMutate()).toBe(false);
    expect(result.planApiBridge).not.toBeNull();
    expect(result.todoRepository.loadTodos()).toEqual(result.initialTodos);
    expect(result.cyclePlanRepository.loadPlans()).toEqual(result.initialCyclePlans);
    expect(result.writeController).not.toBeNull();
    expect(result.startExpanded).toBe(false);
  });

  it.each([
    ["hermes", { type: "hermes", externalId: "hermes-entry-7" }],
    ["ai_draft", { type: "ai_draft", proposalId: "proposal-9" }]
  ] as const)("round-trips a valid %s source from the raw snapshot", async (_label, source) => {
    const bridge = desktopBridge(vi.fn(async () => ({
      todos: [{ ...mockTodos[0], source }],
      cyclePlans: [],
      status: offlineStatus
    })));

    const result = await bootstrapAppData({ bridge });

    expect(result.initialTodos[0].source).toEqual(source);
    expect(result.todoRepository.loadTodos()[0].source).toEqual(source);
  });

  it("falls back to manual for a malformed raw source", async () => {
    const bridge = desktopBridge(vi.fn(async () => ({
      todos: [{
        ...mockTodos[0],
        source: { type: "hermes", externalId: 42 }
      }],
      cyclePlans: [],
      status: offlineStatus
    })));

    const result = await bootstrapAppData({ bridge });

    expect(result.initialTodos[0].source).toEqual({ type: "manual" });
  });

  it("does not disguise an Electron startup failure as empty data", async () => {
    const bridge = desktopBridge(vi.fn(async () => {
      throw new Error("缓存损坏");
    }));

    await expect(bootstrapAppData({ bridge })).rejects.toThrow("缓存损坏");
  });

  it("keeps browser preview mutable and persists same-shape mutations", async () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value)
    };
    const result = await bootstrapAppData({ bridge: undefined, storage });

    expect(result.initialTodos.map((todo) => todo.id)).toEqual(
      mockTodos.map((todo) => todo.id)
    );
    expect(result.initialTodos.every((todo) => todo.source.type === "manual")).toBe(true);
    expect(result.initialCyclePlans).toEqual(mockCyclePlans);
    expect(result.initialDataStatus).toEqual({
      mode: "online",
      canMutate: true,
      message: "浏览器预览数据",
      cacheAvailable: false
    });
    expect(result.mutationGateway.canMutate()).toBe(true);
    expect(result.planApiBridge).toBeNull();
    expect(result.todoRepository).toBeDefined();
    expect(result.cyclePlanRepository).toBeDefined();
    expect(result.writeController).toBeNull();
    expect(result.startExpanded).toBe(true);

    const saved = await result.mutationGateway.execute({
      source: { type: "manual" },
      summary: "新增浏览器待办",
      operations: [{
        type: "todo.create",
        draft: { title: "浏览器待办", date: "2026-07-27" }
      }]
    });
    expect(saved.todos.some((todo) => todo.title === "浏览器待办")).toBe(true);
    expect(values.size).toBe(1);
  });
});
