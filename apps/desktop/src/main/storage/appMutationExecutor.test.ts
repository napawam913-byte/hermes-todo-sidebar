/**
 * 模块用途：验证手动操作与 AI 操作共用同一批量事务执行器。
 * 模块边界：使用内存持久化，不启动 Electron 或真实文件系统。
 */
import { describe, expect, it } from "vitest";
import { createEmptyAppState, type StoredAppStateV1 } from "./appStateTypes.js";
import { AppStateService, type AppStatePersistence } from "./appStateService.js";
import { AppMutationExecutor } from "./appMutationExecutor.js";

const now = "2026-07-15T08:00:00.000Z";

function createMemory() {
  const saved: StoredAppStateV1[] = [];
  const persistence: AppStatePersistence = {
    load: async () => createEmptyAppState(new Date(now)),
    save: async (state) => { saved.push(structuredClone(state)); },
    exportTo: async () => undefined,
    importFrom: async () => createEmptyAppState(new Date(now))
  };
  return { persistence, saved };
}

describe("AppMutationExecutor", () => {
  it("creates manual todos with manual source and persists once", async () => {
    const memory = createMemory();
    const service = new AppStateService(memory.persistence, () => new Date(now));
    await service.initialize();
    const executor = new AppMutationExecutor(service, {
      now: () => new Date(now), idFactory: () => "todo_manual"
    });

    const state = await executor.execute({
      source: { type: "manual" },
      summary: "手动新增待办",
      operations: [{
        type: "todo.create",
        draft: { title: "整理训练计划", date: "2026-07-15" }
      }]
    });

    expect(memory.saved).toHaveLength(1);
    expect(state.todos).toMatchObject([{
      id: "todo_manual",
      source: { type: "manual" },
      syncStatus: "local",
      status: "pending"
    }]);
  });

  it("keeps proposal metadata for AI-created todos", async () => {
    const memory = createMemory();
    const service = new AppStateService(memory.persistence, () => new Date(now));
    await service.initialize();
    const executor = new AppMutationExecutor(service, {
      now: () => new Date(now), idFactory: () => "todo_ai"
    });

    const state = await executor.execute({
      source: { type: "ai_draft", proposalId: "proposal_1" },
      summary: "AI 新增待办",
      operations: [{
        type: "todo.create",
        draft: { title: "学习第 3 章", date: "2026-07-15" }
      }]
    });

    expect(state.todos).toMatchObject([{
      source: { type: "ai_draft", proposalId: "proposal_1" },
      syncStatus: "queued"
    }]);
  });

  it("keeps manually completed todos local", async () => {
    const memory = createMemory();
    memory.persistence.load = async () => ({
      ...createEmptyAppState(new Date(now)),
      todos: [{
        id: "todo_existing",
        title: "完成本地待办",
        date: "2026-07-15",
        status: "pending",
        syncStatus: "local",
        source: { type: "manual" },
        createdAt: now,
        updatedAt: now,
        snoozeCount: 0
      }]
    });
    const service = new AppStateService(memory.persistence, () => new Date(now));
    await service.initialize();
    const executor = new AppMutationExecutor(service, { now: () => new Date(now) });

    const state = await executor.execute({
      source: { type: "manual" },
      summary: "完成待办",
      operations: [{
        type: "todo.complete",
        targetId: "todo_existing",
        expectedUpdatedAt: now,
        targetLabel: "完成本地待办"
      }]
    });

    expect(state.todos[0]).toMatchObject({ status: "completed", syncStatus: "local" });
  });
});
