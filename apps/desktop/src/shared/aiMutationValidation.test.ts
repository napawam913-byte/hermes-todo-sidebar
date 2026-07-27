/**
 * 模块用途：验证 AI 变更提案的严格外层合同与完整操作白名单。
 * 模块边界：只测试纯数据解析，不访问模型、Electron IPC 或本地文件。
 */
import { describe, expect, it } from "vitest";
import { parseModelMutationProposal } from "./aiMutationValidation.js";

const operations = [
  { type: "todo.create", draft: { title: "购买训练手套", date: "2026-07-15" } },
  { type: "todo.update", targetId: "todo_1", patch: { title: "更新标题" } },
  { type: "todo.complete", targetId: "todo_1" },
  { type: "todo.reopen", targetId: "todo_1" },
  { type: "todo.delete", targetId: "todo_1" },
  {
    type: "cyclePlan.create",
    draft: {
      title: "健身计划",
      topic: "健身",
      description: "每周三练",
      entries: [{
        date: "2026-07-15",
        title: "上肢训练",
        contentSummary: "卧推和划船",
        contentBlocks: []
      }]
    }
  },
  { type: "cyclePlan.update", targetId: "plan_1", patch: { title: "三练计划" } },
  { type: "cyclePlan.setStatus", targetId: "plan_1", status: "paused" },
  { type: "cyclePlan.delete", targetId: "plan_1" },
  {
    type: "cyclePlan.entry.create",
    planId: "plan_1",
    draft: {
      date: "2026-07-16",
      title: "上肢训练",
      contentSummary: "卧推和划船",
      contentBlocks: [{
        kind: "fitness.exercise_list",
        title: "训练动作",
        format: "json",
        data: { exercises: [{ name: "卧推", sets: [{ reps: 12, rir: 3 }] }] }
      }]
    }
  },
  {
    type: "cyclePlan.entry.update",
    targetId: "entry_1",
    patch: { contentSummary: "卧推 3 组" }
  },
  { type: "cyclePlan.entry.complete", targetId: "entry_1" },
  { type: "cyclePlan.entry.reopen", targetId: "entry_1" },
  { type: "cyclePlan.entry.skip", targetId: "entry_1" },
  { type: "cyclePlan.entry.delete", targetId: "entry_1" }
];

describe("parseModelMutationProposal", () => {
  it("normalizes Hermes version aliases to the canonical schemaVersion", () => {
    const numeric = parseModelMutationProposal({
      version: 1,
      summary: "请补充计划持续天数",
      operations: []
    });
    const textual = parseModelMutationProposal({
      version: "1.0",
      summary: "请补充计划持续天数",
      operations: []
    });

    expect(numeric).toEqual({
      schemaVersion: 1,
      summary: "请补充计划持续天数",
      operations: []
    });
    expect(textual.schemaVersion).toBe(1);
    expect(textual).not.toHaveProperty("version");
  });

  it("rejects ambiguous or unsupported version aliases", () => {
    expect(() => parseModelMutationProposal({
      schemaVersion: 1,
      version: 1,
      summary: "冲突版本",
      operations: []
    })).toThrow(/未知字段/);

    expect(() => parseModelMutationProposal({
      version: 2,
      summary: "未来版本",
      operations: []
    })).toThrow(/不支持的 AI 提案版本/);
  });

  it("accepts every whitelisted operation and preserves open content data", () => {
    const proposal = parseModelMutationProposal({
      schemaVersion: 1,
      summary: "批量调整计划",
      operations
    });

    expect(proposal.operations.map((operation) => operation.type)).toEqual(
      operations.map((operation) => operation.type)
    );
    expect(proposal.operations[9]).toMatchObject({
      draft: { contentBlocks: [{ data: { exercises: [{ name: "卧推" }] } }] }
    });
    expect(proposal.operations[5]).toMatchObject({
      draft: { entries: [{ date: "2026-07-15", title: "上肢训练" }] }
    });
  });

  it("rejects unknown actions and unknown outer fields", () => {
    expect(() => parseModelMutationProposal({
      schemaVersion: 1,
      summary: "非法操作",
      operations: [{ type: "todo.destroy", targetId: "todo_1" }]
    })).toThrow(/不支持的操作/);

    expect(() => parseModelMutationProposal({
      schemaVersion: 1,
      summary: "多余字段",
      operations: [],
      apiKey: "must-not-pass"
    })).toThrow(/未知字段/);
  });

  it("rejects proposals larger than fifty operations", () => {
    expect(() => parseModelMutationProposal({
      schemaVersion: 1,
      summary: "过大的提案",
      operations: Array.from({ length: 51 }, (_, index) => ({
        type: "todo.create",
        draft: { title: `任务 ${index}`, date: "2026-07-15" }
      }))
    })).toThrow(/50/);

    expect(() => parseModelMutationProposal({
      schemaVersion: 1,
      summary: "过大的新计划",
      operations: [{
        type: "cyclePlan.create",
        draft: {
          title: "超大计划",
          topic: "测试",
          description: "条目过多",
          entries: Array.from({ length: 51 }, (_, index) => ({
            date: "2026-07-15",
            title: `条目 ${index}`,
            contentSummary: "测试",
            contentBlocks: []
          }))
        }
      }]
    })).toThrow(/50/);
  });
});
