/**
 * 模块用途：验证 AI 周期任务调整不会因重复计划或条目 ID 跨计划生效。
 * 模块边界：只测试作用域策略，不执行提案或写入状态文件。
 */
import { describe, expect, it } from "vitest";
import { createEmptyAppState } from "../storage/appStateTypes.js";
import { assertProposalMatchesGenerationContext } from "./aiGenerationPolicy.js";

const timestamp = "2026-07-15T08:00:00.000Z";

describe("AI 周期任务作用域策略", () => {
  it("allows only new cycle plans from the general assistant", () => {
    const state = createEmptyAppState();
    const createProposal = {
      schemaVersion: 1 as const,
      summary: "创建计划",
      operations: [{
        type: "cyclePlan.create" as const,
        draft: { title: "健身", topic: "健身", description: "每周三练" }
      }]
    };

    expect(() => assertProposalMatchesGenerationContext(
      createProposal, state, { type: "assistant" }
    )).not.toThrow();
    expect(() => assertProposalMatchesGenerationContext({
      schemaVersion: 1,
      summary: "越权创建普通待办",
      operations: [{
        type: "todo.create",
        draft: { title: "训练", date: "2026-07-15" }
      }]
    }, state, { type: "assistant" })).toThrow("通用助手只允许创建周期任务");
  });

  it("rejects an entry id that appears in more than one plan", () => {
    const state = {
      ...createEmptyAppState(),
      cyclePlans: [createPlan("plan_1", "entry_duplicate"), createPlan("plan_2", "entry_duplicate")]
    };

    expect(() => assertProposalMatchesGenerationContext({
      schemaVersion: 1,
      summary: "调整重复条目",
      operations: [{
        type: "cyclePlan.entry.update",
        targetId: "entry_duplicate",
        patch: { title: "只应修改一个计划" }
      }]
    }, state, {
      type: "cyclePlan.adjust",
      targetPlanId: "plan_1"
    })).toThrow("周期任务数据存在重复 ID");
  });
});

function createPlan(id: string, entryId: string) {
  return {
    schemaVersion: 2,
    id,
    title: id,
    topic: "测试",
    description: "",
    status: "active",
    source: { type: "manual" },
    createdAt: timestamp,
    updatedAt: timestamp,
    entries: [{
      schemaVersion: 2,
      id: entryId,
      planId: id,
      date: "2026-07-15",
      title: "训练",
      contentSummary: "",
      contentBlocks: [],
      status: "pending",
      source: { type: "manual" },
      createdAt: timestamp,
      updatedAt: timestamp
    }]
  };
}
