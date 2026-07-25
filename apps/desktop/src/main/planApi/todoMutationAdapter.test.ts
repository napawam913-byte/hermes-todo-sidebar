import { describe, expect, it } from "vitest";
import type { Todo } from "../../shared/appDomainTypes.js";
import { PlanApiVersionIndex } from "./planApiVersionIndex.js";
import type { PlanApiSnapshot } from "./planApiWireTypes.js";
import { adaptAppMutationBatch, type MutationAdapterInput } from "./mutationAdapter.js";

const todo: Todo = {
  id: "entry_daily", title: "Read", date: "2026-07-25", notes: "Old notes",
  status: "pending", syncStatus: "synced", source: { type: "manual" },
  createdAt: "2026-07-25T05:00:00Z", updatedAt: "2026-07-25T05:01:01Z", snoozeCount: 0,
};

const wireSnapshot = (): PlanApiSnapshot => ({
  serverRevision: 1,
  tasks: [{
    id: "task_daily", kind: "daily", status: "active", generation_mode: "fixed",
    content: { schemaVersion: 1, kind: "todo.general", title: "Read", summary: "Old notes", locale: "zh-CN", sections: [] },
    schedule_rule: null, generated_through_date: null, rule_revision: 1, version: 2,
    created_at: todo.createdAt, updated_at: "2026-07-25T05:01:00Z",
    entries: [{
      id: todo.id, task_id: "task_daily", scheduled_date: todo.date, status: "pending",
      content: { schemaVersion: 1, kind: "todo.general", title: todo.title, summary: todo.notes!, locale: "zh-CN", sections: [] },
      source: "manual", slot_key: null, is_overridden: false, generation_revision: null,
      version: 3, created_at: todo.createdAt, updated_at: todo.updatedAt, completed_at: null,
    }],
  }],
});

const input = (operations: MutationAdapterInput["batch"]["operations"], source: MutationAdapterInput["batch"]["source"] = { type: "manual" }): MutationAdapterInput => ({
  batch: { source, summary: "Todo mutation", operations },
  snapshot: { todos: [todo], cyclePlans: [] },
  versionIndex: PlanApiVersionIndex.fromSnapshot(wireSnapshot()),
  idempotencyKey: "request-1",
});

describe("Todo mutation adapter", () => {
  it("creates one fixed daily task with one entry and the batch source", () => {
    const result = adaptAppMutationBatch(input([{
      type: "todo.create", draft: { title: "Write", date: "2026-07-26", notes: "Draft" },
    }], { type: "ai_draft", proposalId: "proposal-1" }));

    expect(result.operations).toEqual([{
      type: "task.create",
      draft: expect.objectContaining({
        kind: "daily", status: "active", generation_mode: "fixed",
        schedule_rule: null, generated_through_date: null, rule_revision: 1,
        content: expect.objectContaining({ title: "Write", summary: "Draft" }),
        entries: [expect.objectContaining({
          scheduled_date: "2026-07-26", status: "pending", source: "hermes",
          content: expect.objectContaining({ title: "Write", summary: "Draft" }),
        })],
      }),
    }]);
  });

  it("updates task and entry content together, while date only changes the entry", () => {
    const result = adaptAppMutationBatch(input([{
      type: "todo.update", targetId: todo.id, expectedUpdatedAt: todo.updatedAt,
      patch: { title: "Read deeply", notes: "New notes", date: "2026-07-27" },
    }]));

    expect(result.operations).toEqual([{
      type: "task.update", targetId: "task_daily", expectedVersion: 2,
      patch: { content: expect.objectContaining({ title: "Read deeply", summary: "New notes" }) },
    }, {
      type: "entry.update", targetId: todo.id, expectedVersion: 3,
      patch: {
        scheduled_date: "2026-07-27",
        content: expect.objectContaining({ title: "Read deeply", summary: "New notes" }),
      },
    }]);
  });

  it("maps completion, reopening, and deletion to entry or parent task versions", () => {
    expect(adaptAppMutationBatch(input([
      { type: "todo.complete", targetId: todo.id, expectedUpdatedAt: todo.updatedAt },
      { type: "todo.reopen", targetId: todo.id },
      { type: "todo.delete", targetId: todo.id, expectedUpdatedAt: todo.updatedAt },
    ])).operations).toEqual([
      { type: "entry.complete", targetId: todo.id, expectedVersion: 3 },
      { type: "entry.reopen", targetId: todo.id, expectedVersion: 3 },
      { type: "task.delete", targetId: "task_daily", expectedVersion: 2 },
    ]);
  });
});
