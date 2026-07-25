import { describe, expect, it } from "vitest";
import { mapPlanApiSnapshot } from "./snapshotMapper.js";
import type { PlanApiSnapshot } from "./planApiWireTypes.js";

const content = (kind: string, title: string, summary: string, sections = []) => ({
  schemaVersion: 1 as const, kind, title, summary, locale: "zh-CN", sections,
});

const snapshotFixture = (): PlanApiSnapshot => ({
  serverRevision: 12,
  tasks: [{
    id: "task_daily", kind: "daily" as const, status: "active" as const, generation_mode: "fixed" as const,
    content: content("todo.general", "Daily parent", "Daily parent"), schedule_rule: null, generated_through_date: null,
    rule_revision: 1, version: 7, created_at: "2026-07-25T05:00:00.000Z", updated_at: "2026-07-25T05:01:00.000Z",
    entries: [{
      id: "entry_daily", task_id: "task_daily", scheduled_date: "2026-07-25", status: "completed" as const,
      content: content("todo.general", "Local integration todo", "Investigate wire mapping", [{
        id: "notes", label: "Notes", layout: "markdown" as const,
        fields: [{ key: "notes", label: "Notes", type: "markdown", value: "Investigate wire mapping" }], items: [],
      }]),
      source: "rule_generated" as const, slot_key: null, is_overridden: false, generation_revision: null, version: 3,
      created_at: "2026-07-25T05:00:01.000Z", updated_at: "2026-07-25T05:01:01.127614Z", completed_at: "2026-07-25T05:02:00.000Z",
    }],
  }, {
    id: "task_cycle", kind: "cycle" as const, status: "paused" as const, generation_mode: "rolling" as const,
    content: content("plan.cycle", "Strength", "Three sessions weekly", [{
      id: "metadata", label: "Metadata", layout: "fields" as const,
      fields: [{ key: "topic", label: "Topic", type: "string", value: "Fitness" }], items: [],
    }]), schedule_rule: {}, generated_through_date: null, rule_revision: 2, version: 5,
    created_at: "2026-07-24T05:00:00.000Z", updated_at: "2026-07-25T05:03:00.000Z",
    entries: [{
      id: "entry_cycle", task_id: "task_cycle", scheduled_date: "2026-07-26", status: "skipped" as const,
      content: content("plan.cycle_entry", "Upper body", "Bench press", [{
        id: "block_1", label: "Exercises", layout: "fields" as const,
        fields: [{ key: "contentBlock", label: "Exercises", type: "object", value: {
          schemaVersion: 2, id: "block_1", kind: "fitness.exercises", title: "Exercises", format: "json", data: { count: 3 },
        } }], items: [],
      }]),
      source: "hermes" as const, slot_key: "morning", is_overridden: false, generation_revision: 2, version: 6,
      created_at: "2026-07-24T05:00:00.000Z", updated_at: "2026-07-25T05:04:00.000Z", completed_at: null,
    }],
  }],
});

describe("mapPlanApiSnapshot", () => {
  it("maps a daily entry id to Todo.id and indexes its parent task", () => {
    const result = mapPlanApiSnapshot(snapshotFixture());

    expect(result.todos).toEqual([expect.objectContaining({
      id: "entry_daily", title: "Local integration todo", date: "2026-07-25", notes: "Investigate wire mapping",
      status: "completed", syncStatus: "synced", source: { type: "hermes" },
      createdAt: "2026-07-25T05:00:01.000Z", updatedAt: "2026-07-25T05:01:01.127614Z", completedAt: "2026-07-25T05:02:00.000Z",
    })]);
    expect(result.versionIndex.requireEntry("entry_daily")).toEqual({
      id: "entry_daily", taskId: "task_daily", version: 3, updatedAt: "2026-07-25T05:01:01.127614Z",
    });
    expect(result.versionIndex.requireTask("task_daily")).toMatchObject({ id: "task_daily", version: 7 });
    expect(result.serverRevision).toBe(12);
  });

  it("maps a cycle task without draft or candidate states and preserves blocks", () => {
    const result = mapPlanApiSnapshot(snapshotFixture());

    expect(result.cyclePlans).toEqual([expect.objectContaining({
      schemaVersion: 2, id: "task_cycle", title: "Strength", topic: "Fitness", description: "Three sessions weekly",
      status: "paused", createdAt: "2026-07-24T05:00:00.000Z", updatedAt: "2026-07-25T05:03:00.000Z",
      entries: [expect.objectContaining({
        id: "entry_cycle", planId: "task_cycle", status: "skipped", source: { type: "hermes" },
        contentBlocks: [{ schemaVersion: 2, id: "block_1", kind: "fitness.exercises", title: "Exercises", format: "json", data: { count: 3 } }],
      })],
    })]);
  });
});
