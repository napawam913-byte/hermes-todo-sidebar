import { describe, expect, it } from "vitest";
import { PlanApiVersionIndex } from "./planApiVersionIndex.js";
import type { PlanApiSnapshot } from "./planApiWireTypes.js";

const snapshot = (): PlanApiSnapshot => ({
  serverRevision: 8,
  tasks: [{
    id: "task_1", kind: "daily", status: "active", generation_mode: "fixed",
    content: { schemaVersion: 1, kind: "todo.general", title: "Todo", summary: "Todo", locale: "zh-CN", sections: [] },
    schedule_rule: null, generated_through_date: null, rule_revision: 1, version: 4,
    created_at: "2026-07-25T05:00:00.000Z", updated_at: "2026-07-25T05:01:00.000Z",
    entries: [{
      id: "entry_1", task_id: "task_1", scheduled_date: "2026-07-25", status: "pending",
      content: { schemaVersion: 1, kind: "todo.general", title: "Todo", summary: "Todo", locale: "zh-CN", sections: [] },
      source: "manual", slot_key: null, is_overridden: false, generation_revision: null, version: 3,
      created_at: "2026-07-25T05:00:00.000Z", updated_at: "2026-07-25T05:01:01.127614Z", completed_at: null,
    }],
  }],
});

describe("PlanApiVersionIndex", () => {
  it("indexes task and entry versions from a snapshot", () => {
    const index = PlanApiVersionIndex.fromSnapshot(snapshot());

    expect(index.requireTask("task_1")).toEqual({ id: "task_1", version: 4, updatedAt: "2026-07-25T05:01:00.000Z" });
    expect(index.requireEntry("entry_1")).toEqual({
      id: "entry_1", taskId: "task_1", version: 3, updatedAt: "2026-07-25T05:01:01.127614Z",
    });
  });

  it("throws clear errors for missing task and entry versions", () => {
    const index = PlanApiVersionIndex.fromSnapshot(snapshot());

    expect(() => index.requireTask("missing-task")).toThrow("Unknown Plan API task: missing-task");
    expect(() => index.requireEntry("missing-entry")).toThrow("Unknown Plan API entry: missing-entry");
  });
});
