/**
 * 模块用途：验证 AI 提案跨待办和周期计划的原子执行与冲突保护。
 * 模块边界：使用内存持久化，不调用模型、Electron IPC 或真实文件系统。
 */
import { describe, expect, it } from "vitest";
import type { AiMutationProposal } from "../../shared/aiMutationTypes.js";
import { createEmptyAppState, type StoredAppStateV1 } from "../storage/appStateTypes.js";
import { AppStateService, type AppStatePersistence } from "../storage/appStateService.js";
import { AiProposalExecutor } from "./aiProposalExecutor.js";

const timestamp = "2026-07-14T09:00:00.000Z";

function initialState(): StoredAppStateV1 {
  return {
    ...createEmptyAppState(new Date(timestamp)),
    todos: [{
      id: "todo_1", title: "整理训练动作", date: "2026-07-14",
      status: "pending", syncStatus: "local", source: { type: "manual" },
      createdAt: timestamp, updatedAt: timestamp, snoozeCount: 0
    }],
    cyclePlans: [{
      schemaVersion: 2, id: "plan_1", title: "健身计划", topic: "健身",
      description: "每周两练", status: "active", source: { type: "manual" },
      createdAt: timestamp, updatedAt: timestamp,
      entries: [{
        schemaVersion: 2, id: "entry_1", planId: "plan_1", date: "2026-07-14",
        title: "周日复盘", contentSummary: "回顾训练", contentBlocks: [],
        status: "pending", source: { type: "manual" }, createdAt: timestamp,
        updatedAt: timestamp
      }]
    }]
  };
}

function memoryPersistence(state = initialState()) {
  const saved: StoredAppStateV1[] = [];
  const persistence: AppStatePersistence = {
    load: async () => structuredClone(state),
    save: async (value) => { saved.push(structuredClone(value)); },
    exportTo: async () => undefined,
    importFrom: async () => structuredClone(state)
  };
  return { persistence, saved };
}

function makeProposal(operations: AiMutationProposal["operations"]): AiMutationProposal {
  return { schemaVersion: 1, proposalId: "proposal_1", summary: "调整健身计划", operations };
}

describe("AiProposalExecutor", () => {
  it("applies a mixed batch and persists exactly once", async () => {
    const memory = memoryPersistence();
    const service = new AppStateService(memory.persistence, () => new Date("2026-07-14T10:00:00.000Z"));
    await service.initialize();
    const ids = ["todo_ai", "block_ai"];
    const executor = new AiProposalExecutor(service, {
      now: () => new Date("2026-07-14T10:00:00.000Z"),
      idFactory: () => ids.shift() ?? "generated"
    });

    const result = await executor.execute(makeProposal([
      { type: "todo.create", draft: { title: "购买训练手套", date: "2026-07-15" } },
      {
        type: "cyclePlan.update", targetId: "plan_1", expectedUpdatedAt: timestamp,
        patch: { description: "每周三练" }
      },
      { type: "todo.complete", targetId: "todo_1", expectedUpdatedAt: timestamp },
      { type: "cyclePlan.entry.delete", targetId: "entry_1", expectedUpdatedAt: timestamp }
    ]));

    expect(memory.saved).toHaveLength(1);
    expect(result.todos).toMatchObject([
      { id: "todo_ai", source: { type: "ai_draft", proposalId: "proposal_1" } },
      { id: "todo_1", status: "completed" }
    ]);
    expect(result.cyclePlans).toMatchObject([
      { id: "plan_1", description: "每周三练", entries: [] }
    ]);
  });

  it("rolls back the entire batch when any target is missing", async () => {
    const memory = memoryPersistence();
    const service = new AppStateService(memory.persistence);
    await service.initialize();
    const before = service.getSnapshot();
    const executor = new AiProposalExecutor(service);

    await expect(executor.execute(makeProposal([
      { type: "todo.create", draft: { title: "不会保存", date: "2026-07-15" } },
      { type: "todo.delete", targetId: "missing", expectedUpdatedAt: timestamp }
    ]))).rejects.toMatchObject({ code: "target_missing" });
    expect(memory.saved).toHaveLength(0);
    expect(service.getSnapshot()).toEqual(before);
  });

  it("rejects stale updatedAt values without writing", async () => {
    const memory = memoryPersistence();
    const service = new AppStateService(memory.persistence);
    await service.initialize();
    const executor = new AiProposalExecutor(service);

    await expect(executor.execute(makeProposal([{
      type: "todo.update", targetId: "todo_1",
      expectedUpdatedAt: "2026-07-14T08:00:00.000Z", patch: { title: "过期修改" }
    }]))).rejects.toMatchObject({ code: "version_conflict", targetId: "todo_1" });
    expect(memory.saved).toHaveLength(0);
  });

  it("rolls back memory state when persistence fails", async () => {
    const original = initialState();
    const persistence: AppStatePersistence = {
      load: async () => structuredClone(original),
      save: async () => { throw new Error("磁盘不可写"); },
      exportTo: async () => undefined,
      importFrom: async () => structuredClone(original)
    };
    const service = new AppStateService(persistence);
    await service.initialize();
    const before = service.getSnapshot();
    const executor = new AiProposalExecutor(service);

    await expect(executor.execute(makeProposal([{
      type: "todo.create", draft: { title: "不会落盘", date: "2026-07-15" }
    }]))).rejects.toMatchObject({ code: "persistence_failed" });
    expect(service.getSnapshot()).toEqual(before);
  });

  it("deletes a plan together with all of its entries", async () => {
    const memory = memoryPersistence();
    const service = new AppStateService(memory.persistence);
    await service.initialize();
    const executor = new AiProposalExecutor(service);

    const result = await executor.execute(makeProposal([{
      type: "cyclePlan.delete", targetId: "plan_1", expectedUpdatedAt: timestamp
    }]));
    expect(result.cyclePlans).toEqual([]);
    expect(memory.saved).toHaveLength(1);
  });

  it("creates a new plan and its dated entries in one operation", async () => {
    const memory = memoryPersistence();
    const service = new AppStateService(memory.persistence);
    await service.initialize();
    const ids = ["plan_ai", "entry_ai", "block_ai"];
    const executor = new AiProposalExecutor(service, {
      now: () => new Date("2026-07-14T10:00:00.000Z"),
      idFactory: () => ids.shift() ?? "generated"
    });

    const result = await executor.execute(makeProposal([{
      type: "cyclePlan.create",
      draft: {
        title: "7 天教程计划",
        topic: "学习",
        description: "每天推进一个小节",
        entries: [{
          date: "2026-07-15",
          title: "学习第 1 节",
          contentSummary: "阅读并整理三个要点",
          contentBlocks: [{
            kind: "learning.tutorial_section",
            title: "教程进度",
            format: "json",
            data: { chapter: "第 1 章", section: "1.1" }
          }]
        }]
      }
    }]));

    expect(result.cyclePlans[0]).toMatchObject({
      id: "plan_ai",
      source: { type: "ai_draft", proposalId: "proposal_1" },
      entries: [{
        id: "entry_ai",
        planId: "plan_ai",
        source: { type: "ai_draft", proposalId: "proposal_1" },
        contentBlocks: [{ id: "block_ai" }]
      }]
    });
  });
});
