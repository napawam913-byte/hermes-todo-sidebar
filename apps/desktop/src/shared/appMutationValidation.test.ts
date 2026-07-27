/**
 * 模块用途：验证 renderer 提交到主进程的通用变更批次只接受白名单字段和操作。
 * 模块边界：不执行操作，也不读写本地状态文件。
 */
import { describe, expect, it } from "vitest";
import { parseAppMutationBatch } from "./appMutationValidation";

describe("parseAppMutationBatch", () => {
  it("preserves main-process version metadata on a valid manual operation", () => {
    const batch = parseAppMutationBatch({
      source: { type: "manual" },
      summary: "完成待办",
      operations: [{
        type: "todo.complete",
        targetId: "todo_1",
        expectedUpdatedAt: "2026-07-15T08:00:00.000Z",
        targetLabel: "训练"
      }]
    });

    expect(batch.operations[0]).toMatchObject({
      type: "todo.complete",
      expectedUpdatedAt: "2026-07-15T08:00:00.000Z",
      targetLabel: "训练"
    });
  });

  it("rejects unknown outer fields and batches over 50 operations", () => {
    expect(() => parseAppMutationBatch({
      source: { type: "manual" },
      summary: "非法批次",
      operations: [],
      databasePath: "C:/secret"
    })).toThrow("未知字段");

    expect(() => parseAppMutationBatch({
      source: { type: "manual" },
      summary: "过大批次",
      operations: Array.from({ length: 51 }, () => ({
        type: "todo.create",
        draft: { title: "任务", date: "2026-07-15" }
      }))
    })).toThrow("50");
  });
});
