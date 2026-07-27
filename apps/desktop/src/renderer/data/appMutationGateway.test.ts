/**
 * 模块用途：验证 Electron 与浏览器预览使用同形的应用变更网关。
 * 模块边界：不挂载 React，不调用真实 IPC 或浏览器 localStorage。
 */
import { describe, expect, it, vi } from "vitest";
import type { PlanApiRuntimeStatus } from "../../shared/planApiBridgeContract";
import type { PlanApiSnapshotEnvelope } from "../../shared/planApiBridgeContract";
import { createBrowserMutationGateway, createElectronMutationGateway } from "./appMutationGateway";

const request = {
  source: { type: "manual" as const },
  summary: "新增待办",
  operations: [{
    type: "todo.create" as const,
    draft: { title: "训练", date: "2026-07-15" }
  }]
};

describe("AppMutationGateway", () => {
  it("rejects Electron mutations before IPC while the data service is offline", async () => {
    const status: PlanApiRuntimeStatus = {
      mode: "offline_cache",
      canMutate: false,
      message: "数据服务离线，当前仅可查看",
      cacheAvailable: true
    };
    const executeMutations = vi.fn();
    const gateway = createElectronMutationGateway(
      { executeMutations },
      () => status
    );

    expect(gateway.canMutate()).toBe(false);
    await expect(gateway.execute(request)).rejects.toThrow(
      "数据服务离线，当前仅可查看"
    );
    expect(executeMutations).not.toHaveBeenCalled();
  });

  it("dynamically forwards Electron mutations when status becomes writable", async () => {
    let status: PlanApiRuntimeStatus = {
      mode: "offline_cache", canMutate: false, message: "离线", cacheAvailable: true
    };
    const envelope: PlanApiSnapshotEnvelope = {
      todos: [{ id: "todo_1" }],
      cyclePlans: [],
      status: { mode: "online", canMutate: true, message: "在线", cacheAvailable: true }
    };
    const executeMutations = vi.fn(async () => envelope);
    const gateway = createElectronMutationGateway({ executeMutations }, () => status);

    status = envelope.status;
    expect(gateway.canMutate()).toBe(true);
    await expect(gateway.execute(request)).resolves.toEqual({
      todos: [{ id: "todo_1" }], cyclePlans: []
    });
    expect(executeMutations).toHaveBeenCalledWith(request);
  });

  it("applies browser mutations and saves one combined snapshot", async () => {
    const values = new Map<string, string>();
    const gateway = createBrowserMutationGateway({
      initialState: { todos: [], cyclePlans: [] },
      storage: {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => { values.set(key, value); }
      },
      now: () => new Date("2026-07-15T08:00:00.000Z"),
      idFactory: () => "todo_browser"
    });

    expect(gateway.canMutate()).toBe(true);
    const state = await gateway.execute(request);
    expect(state.todos).toMatchObject([{
      id: "todo_browser", source: { type: "manual" }, status: "pending"
    }]);
    expect([...values.values()]).toHaveLength(1);
  });

  it("does not advance browser memory when localStorage persistence fails", async () => {
    let fail = true;
    const gateway = createBrowserMutationGateway({
      initialState: { todos: [], cyclePlans: [] },
      storage: {
        getItem: () => null,
        setItem: () => { if (fail) throw new Error("空间不足"); }
      },
      now: () => new Date("2026-07-15T08:00:00.000Z"),
      idFactory: (() => { let value = 0; return () => `todo_${++value}`; })()
    });

    await expect(gateway.execute(request)).rejects.toThrow("空间不足");
    fail = false;
    const state = await gateway.execute(request);
    expect(state.todos).toHaveLength(1);
    expect(state.todos[0]).toMatchObject({ id: "todo_2" });
  });

  it("creates plan entries and applies entry status mutations in browser preview", async () => {
    let sequence = 0;
    const gateway = createBrowserMutationGateway({
      initialState: { todos: [], cyclePlans: [] },
      now: () => new Date("2026-07-15T08:00:00.000Z"),
      idFactory: (prefix) => `${prefix}_${++sequence}`
    });

    const created = await gateway.execute({
      source: { type: "manual" },
      summary: "创建训练计划",
      operations: [{
        type: "cyclePlan.create",
        draft: {
          title: "训练计划",
          topic: "健身",
          description: "每周训练",
          entries: [{
            date: "2026-07-15",
            title: "力量训练",
            contentSummary: "卧推三组",
            contentBlocks: [{
              kind: "fitness.exercise_list",
              title: "训练动作",
              format: "json",
              data: { exercises: ["卧推"] }
            }]
          }]
        }
      }]
    });
    const entry = created.cyclePlans[0].entries[0];

    const completed = await gateway.execute({
      source: { type: "manual" },
      summary: "完成训练",
      operations: [{
        type: "cyclePlan.entry.complete",
        targetId: entry.id,
        expectedUpdatedAt: entry.updatedAt
      }]
    });
    expect(completed.cyclePlans[0].entries[0]).toMatchObject({
      id: entry.id,
      status: "completed"
    });
  });

  it("rejects a stale browser batch without persisting partial changes", async () => {
    const setItem = vi.fn();
    const gateway = createBrowserMutationGateway({
      initialState: {
        todos: [{
          id: "todo_existing",
          title: "原任务",
          date: "2026-07-15",
          status: "pending",
          syncStatus: "local",
          source: { type: "manual" },
          createdAt: "2026-07-15T07:00:00.000Z",
          updatedAt: "2026-07-15T07:00:00.000Z",
          snoozeCount: 0
        }],
        cyclePlans: []
      },
      storage: { getItem: () => null, setItem }
    });

    await expect(gateway.execute({
      source: { type: "manual" },
      summary: "过期修改",
      operations: [{
        type: "todo.update",
        targetId: "todo_existing",
        expectedUpdatedAt: "2026-07-15T06:00:00.000Z",
        patch: { title: "不应写入" }
      }]
    })).rejects.toThrow("版本冲突");
    expect(setItem).not.toHaveBeenCalled();
  });
});
