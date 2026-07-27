/** 模块用途：验证 Electron 仓储把完整数组保存转换为真实 Plan API 变更。 */
import { describe, expect, it, vi } from "vitest";
import { mockCyclePlans } from "../features/cyclePlans/mockCyclePlans";
import { mockTodos } from "../features/todos/mockTodos";
import { createElectronRepositories, type DesktopDataBridge } from "./electronRepositories";

function bridge(): DesktopDataBridge {
  return { loadState: vi.fn(), executeMutations: vi.fn(async (batch) => ({ todos: [], cyclePlans: [], batch })) };
}
async function flush() { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); }

describe("createElectronRepositories", () => {
  it("loads startup data and submits todo create, update, status, and delete mutations", async () => {
    const current = [...structuredClone(mockTodos), { ...mockTodos[0], id: "deleted" }];
    current[2].status = "completed";
    const next = [
      { ...current[0], title: "updated", updatedAt: "2026-07-16T00:00:00.000Z" },
      { ...current[1], status: "completed" as const, updatedAt: "2026-07-16T00:00:00.000Z" },
      { ...current[2], status: "pending" as const },
      { ...current[0], id: "new", title: "new todo", status: "pending" as const },
    ];
    const port = bridge();
    const repositories = createElectronRepositories({ bridge: port, todos: current, cyclePlans: [] });

    expect(repositories.todoRepository.loadTodos()).toEqual(current);
    repositories.todoRepository.saveTodos(next);
    await flush();
    expect(port.executeMutations).toHaveBeenCalledOnce();
    const types = (port.executeMutations as ReturnType<typeof vi.fn>).mock.calls[0][0].operations.map((item: { type: string }) => item.type);
    expect(types).toEqual(expect.arrayContaining(["todo.create", "todo.update", "todo.complete", "todo.reopen", "todo.delete"]));
  });

  it("submits cycle plan, entry, status, and delete mutations", async () => {
    const base = structuredClone(mockCyclePlans[0]);
    base.entries.push({ ...base.entries[0], id: "entry_reopen", status: "completed" });
    base.entries.push({ ...base.entries[0], id: "entry_deleted" });
    const current = [base, { ...structuredClone(mockCyclePlans[1]), id: "plan_deleted" }];
    const plan = structuredClone(current[0]);
    plan.title = "updated plan";
    plan.status = "paused";
    plan.entries[0].title = "updated entry";
    plan.entries[1].status = "completed";
    plan.entries[2].status = "skipped";
    plan.entries[3].status = "pending";
    plan.entries = plan.entries.filter((entry) => entry.id !== "entry_deleted");
    plan.entries.push({ ...plan.entries[0], id: "entry_new", title: "new entry", updatedAt: "2026-07-16T00:00:00.000Z" });
    const port = bridge();
    const repositories = createElectronRepositories({ bridge: port, todos: [], cyclePlans: current });

    repositories.cyclePlanRepository.savePlans([plan, { ...mockCyclePlans[1], id: "plan_new" }]);
    await flush();
    expect(port.executeMutations).toHaveBeenCalledOnce();
    const types = (port.executeMutations as ReturnType<typeof vi.fn>).mock.calls[0][0].operations.map((item: { type: string }) => item.type);
    expect(types).toEqual(expect.arrayContaining([
      "cyclePlan.create", "cyclePlan.update", "cyclePlan.setStatus", "cyclePlan.entry.create",
      "cyclePlan.delete", "cyclePlan.entry.update", "cyclePlan.entry.complete", "cyclePlan.entry.reopen",
      "cyclePlan.entry.skip", "cyclePlan.entry.delete"
    ]));
  });

  it("restores authoritative data, reports a failure, and retries retained intent", async () => {
    const current = structuredClone(mockTodos);
    const next = [{ ...current[0], title: "retry me" }, ...current.slice(1)];
    const failure = new Error("offline");
    const port: DesktopDataBridge = {
      loadState: vi.fn(),
      executeMutations: vi.fn()
        .mockRejectedValueOnce(failure)
        .mockResolvedValueOnce({ todos: next, cyclePlans: [] })
    };
    const repositories = createElectronRepositories({ bridge: port, todos: current, cyclePlans: [] });
    const states: unknown[] = [];
    repositories.onWriteStateChanged((state) => states.push(state));

    repositories.todoRepository.saveTodos(next);
    await flush();
    expect(repositories.todoRepository.loadTodos()).toEqual(current);
    expect(repositories.getWriteState()).toEqual({ pending: false, error: "offline" });
    expect(states).toContainEqual({ pending: false, error: "offline" });

    repositories.retryPending();
    await flush();
    expect(port.executeMutations).toHaveBeenCalledTimes(2);
    expect(repositories.todoRepository.loadTodos()).toEqual(next);
    expect(repositories.getWriteState()).toEqual({ pending: false });
  });
});
