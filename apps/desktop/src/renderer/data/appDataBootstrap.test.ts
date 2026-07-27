/**
 * 模块用途：验证正式桌面状态与浏览器 Demo 使用不同启动数据源。
 * 模块边界：只测试启动选择和领域归一化，不挂载 React。
 */
import { describe, expect, it, vi } from "vitest";
import { mockCyclePlans } from "../features/cyclePlans/mockCyclePlans";
import { mockTodos } from "../features/todos/mockTodos";
import { bootstrapAppData } from "./appDataBootstrap";
import type { DesktopDataBridge } from "./electronRepositories";

describe("bootstrapAppData", () => {
  it("normalizes Electron state without inserting demo rows", async () => {
    const legacyTodo = { ...mockTodos[0] } as Record<string, unknown>;
    delete legacyTodo.date;
    const bridge = {
      loadState: vi.fn(async () => ({
        schemaVersion: 1 as const,
        todos: [legacyTodo, { broken: true }],
        cyclePlans: [mockCyclePlans[0], { broken: true }],
        settings: { launchAtLogin: true },
        updatedAt: "2026-07-12T10:00:00.000Z"
      })),
      executeMutations: vi.fn(async () => ({ todos: [], cyclePlans: [] }))
    } satisfies DesktopDataBridge;

    const result = await bootstrapAppData({ bridge });

    expect(result.initialTodos).toHaveLength(1);
    expect(result.initialTodos[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.initialCyclePlans).toEqual([mockCyclePlans[0]]);
    expect(result.startExpanded).toBe(false);
    await result.mutationGateway.execute({
      source: { type: "manual" },
      summary: "测试",
      operations: []
    });
    expect(bridge.executeMutations).toHaveBeenCalledOnce();
  });

  it("keeps mock fallback only for browser preview", async () => {
    const result = await bootstrapAppData({ bridge: undefined, storage: undefined });

    expect(result.initialTodos).toEqual(mockTodos);
    expect(result.initialCyclePlans).toEqual(mockCyclePlans);
    expect(result.startExpanded).toBe(true);
    await expect(result.mutationGateway.execute({
      source: { type: "manual" }, summary: "空批次", operations: []
    })).resolves.toMatchObject({ todos: mockTodos, cyclePlans: mockCyclePlans });
  });
});
