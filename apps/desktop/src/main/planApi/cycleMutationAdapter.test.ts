import { describe, expect, it } from "vitest";
import type { CyclePlan } from "../../shared/appDomainTypes.js";
import { PlanApiVersionIndex } from "./planApiVersionIndex.js";
import type { PlanApiSnapshot } from "./planApiWireTypes.js";
import { adaptAppMutationBatch, type MutationAdapterInput } from "./mutationAdapter.js";

const plan: CyclePlan = {
  schemaVersion: 2, id: "task_cycle", title: "Strength", topic: "Fitness", description: "Weekly",
  status: "active", source: { type: "manual" }, createdAt: "2026-07-25T04:00:00Z",
  updatedAt: "2026-07-25T05:00:00Z",
  entries: [{
    schemaVersion: 2, id: "entry_cycle", planId: "task_cycle", date: "2026-07-26",
    title: "Upper", contentSummary: "Bench", contentBlocks: [], status: "pending",
    source: { type: "manual" }, createdAt: "2026-07-25T04:00:00Z", updatedAt: "2026-07-25T05:01:00Z",
  }],
};
const document = (kind: string, title: string, summary: string) => ({
  schemaVersion: 1 as const, kind, title, summary, locale: "zh-CN", sections: [],
});
const wireSnapshot = (): PlanApiSnapshot => ({
  serverRevision: 1,
  tasks: [{
    id: plan.id, kind: "cycle", status: "active", generation_mode: "fixed",
    content: document("plan.cycle", plan.title, plan.description), schedule_rule: null,
    generated_through_date: null, rule_revision: 1, version: 5,
    created_at: plan.createdAt, updated_at: plan.updatedAt,
    entries: [{
      id: "entry_cycle", task_id: plan.id, scheduled_date: "2026-07-26", status: "pending",
      content: document("plan.cycle_entry", "Upper", "Bench"), source: "manual",
      slot_key: null, is_overridden: false, generation_revision: null, version: 6,
      created_at: plan.createdAt, updated_at: plan.entries[0]!.updatedAt, completed_at: null,
    }],
  }],
});
const block = { kind: "fitness.sets", title: "Sets", format: "json" as const, data: { count: 3 } };
const entryDraft = { date: "2026-07-27", title: "Lower", contentSummary: "Squat", contentBlocks: [block] };
const input = (operations: MutationAdapterInput["batch"]["operations"]): MutationAdapterInput => ({
  batch: { source: { type: "manual" }, summary: "Cycle mutation", operations },
  snapshot: { todos: [], cyclePlans: [plan] },
  versionIndex: PlanApiVersionIndex.fromSnapshot(wireSnapshot()),
  idempotencyKey: "request-2",
});

describe("Cycle mutation adapter", () => {
  it("creates a fixed cycle task with embedded entries and maps draft to paused", () => {
    const result = adaptAppMutationBatch(input([{
      type: "cyclePlan.create",
      draft: { title: "Run", topic: "Health", description: "5K", status: "draft", entries: [entryDraft] },
    }]));

    expect(result.operations).toEqual([{
      type: "task.create",
      draft: expect.objectContaining({
        kind: "cycle", status: "paused", generation_mode: "fixed",
        content: expect.objectContaining({ title: "Run", summary: "5K" }),
        entries: [expect.objectContaining({
          scheduled_date: entryDraft.date, status: "pending", source: "manual",
          content: expect.objectContaining({ title: "Lower", summary: "Squat" }),
        })],
      }),
    }]);
  });

  it("maps plan updates, statuses, and deletion with the task version", () => {
    expect(adaptAppMutationBatch(input([
      { type: "cyclePlan.update", targetId: plan.id, expectedUpdatedAt: plan.updatedAt, patch: { title: "Power" } },
      { type: "cyclePlan.setStatus", targetId: plan.id, status: "draft" },
      { type: "cyclePlan.delete", targetId: plan.id },
    ])).operations).toEqual([
      { type: "task.update", targetId: plan.id, expectedVersion: 5, patch: {
        content: expect.objectContaining({ title: "Power", summary: "Weekly" }),
      } },
      { type: "task.setStatus", targetId: plan.id, expectedVersion: 6, status: "paused" },
      { type: "task.delete", targetId: plan.id, expectedVersion: 7 },
    ]);
  });

  it("maps every entry operation with the entry or containing task version", () => {
    expect(adaptAppMutationBatch(input([
      { type: "cyclePlan.entry.create", planId: plan.id, expectedUpdatedAt: plan.updatedAt, draft: entryDraft },
      { type: "cyclePlan.entry.update", targetId: "entry_cycle", patch: { date: "2026-07-28", title: "Upper+" } },
      { type: "cyclePlan.entry.complete", targetId: "entry_cycle", expectedUpdatedAt: plan.entries[0]!.updatedAt },
      { type: "cyclePlan.entry.reopen", targetId: "entry_cycle" },
      { type: "cyclePlan.entry.skip", targetId: "entry_cycle" },
      { type: "cyclePlan.entry.delete", targetId: "entry_cycle" },
    ])).operations).toEqual([
      { type: "entry.create", taskId: plan.id, draft: expect.objectContaining({ scheduled_date: entryDraft.date }) },
      { type: "entry.update", targetId: "entry_cycle", expectedVersion: 6, patch: {
        scheduledDate: "2026-07-28", content: expect.objectContaining({ title: "Upper+" }),
      } },
      { type: "entry.complete", targetId: "entry_cycle", expectedVersion: 7 },
      { type: "entry.reopen", targetId: "entry_cycle", expectedVersion: 8 },
      { type: "entry.skip", targetId: "entry_cycle", expectedVersion: 9 },
      { type: "entry.delete", targetId: "entry_cycle", expectedVersion: 10 },
    ]);
  });

  it("rejects missing and stale parents for cycle entry creation", () => {
    expect(() => adaptAppMutationBatch(input([{
      type: "cyclePlan.entry.create", planId: "missing", draft: entryDraft,
    }]))).toThrowError(expect.objectContaining({ code: "validation_failed" }));
    expect(() => adaptAppMutationBatch(input([{
      type: "cyclePlan.entry.create", planId: plan.id,
      expectedUpdatedAt: "2026-07-25T06:00:00Z", draft: entryDraft,
    }]))).toThrowError(expect.objectContaining({ code: "version_conflict" }));
  });
});
