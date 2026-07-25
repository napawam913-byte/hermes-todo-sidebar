import { describe, expect, it } from "vitest";
import type { Todo } from "../../shared/appDomainTypes.js";
import { PlanApiError } from "./planApiErrors.js";
import { PlanApiVersionIndex } from "./planApiVersionIndex.js";
import type { PlanApiSnapshot } from "./planApiWireTypes.js";
import { adaptAppMutationBatch, type MutationAdapterInput } from "./mutationAdapter.js";

const todo: Todo = {
  id: "entry_1", title: "Todo", date: "2026-07-25", status: "pending", syncStatus: "synced",
  source: { type: "manual" }, createdAt: "2026-07-25T00:00:00Z",
  updatedAt: "2026-07-25T01:00:00Z", snoozeCount: 0,
};
const wireSnapshot = (): PlanApiSnapshot => ({
  serverRevision: 1,
  tasks: [{
    id: "task_1", kind: "daily", status: "active", generation_mode: "fixed",
    content: { schemaVersion: 1, kind: "todo.general", title: "Todo", summary: "Todo", locale: "zh-CN", sections: [] },
    schedule_rule: null, generated_through_date: null, rule_revision: 1, version: 2,
    created_at: todo.createdAt, updated_at: "2026-07-25T00:30:00Z",
    entries: [{
      id: todo.id, task_id: "task_1", scheduled_date: todo.date, status: "pending",
      content: { schemaVersion: 1, kind: "todo.general", title: "Todo", summary: "Todo", locale: "zh-CN", sections: [] },
      source: "manual", slot_key: null, is_overridden: false, generation_revision: null,
      version: 3, created_at: todo.createdAt, updated_at: todo.updatedAt, completed_at: null,
    }],
  }],
});
const input = (operations: MutationAdapterInput["batch"]["operations"], todos = [todo]): MutationAdapterInput => ({
  batch: { source: { type: "manual" }, summary: "Batch", operations },
  snapshot: { todos, cyclePlans: [] },
  versionIndex: PlanApiVersionIndex.fromSnapshot(wireSnapshot()),
  idempotencyKey: "ordered-request",
});

describe("adaptAppMutationBatch", () => {
  it("preserves operation order after one input expands to two wire operations", () => {
    const result = adaptAppMutationBatch(input([
      { type: "todo.update", targetId: todo.id, patch: { title: "Changed" } },
      { type: "todo.complete", targetId: todo.id },
    ]));

    expect(result.idempotencyKey).toBe("ordered-request");
    expect(result.operations.map((operation) => operation.type))
      .toEqual(["task.update", "entry.update", "entry.complete"]);
  });

  it("throws a safe version conflict before adapting a stale target", () => {
    expect(() => adaptAppMutationBatch(input([{
      type: "todo.delete", targetId: todo.id, expectedUpdatedAt: "2026-07-25T02:00:00Z",
    }]))).toThrowError(expect.objectContaining<Partial<PlanApiError>>({
      name: "PlanApiError", code: "version_conflict", message: "Plan API version conflict",
    }));
  });

  it("fails clearly when a target does not exist", () => {
    expect(() => adaptAppMutationBatch(input([{
      type: "todo.complete", targetId: "missing",
    }], []))).toThrowError(expect.objectContaining<Partial<PlanApiError>>({
      name: "PlanApiError", code: "validation_failed",
    }));
  });

  it("rejects batches whose final operation count is outside 1..100", () => {
    expect(() => adaptAppMutationBatch(input([]))).toThrowError(PlanApiError);
    const operations = Array.from({ length: 51 }, () => ({
      type: "todo.update" as const, targetId: todo.id, patch: { title: "Changed" },
    }));
    expect(() => adaptAppMutationBatch(input(operations))).toThrowError(PlanApiError);
  });
});
