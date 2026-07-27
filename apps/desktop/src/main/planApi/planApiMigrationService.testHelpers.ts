import { vi } from "vitest";
import { PlanApiMigrationService } from "./planApiMigrationService.js";
import type { PlanApiMutationBatch } from "./planApiWireTypes.js";

export const time = "2026-07-25T00:00:00.000Z";

export const todo = (patch: Record<string, unknown> = {}) => ({
  id: "todo-1", title: "Todo", date: "2026-07-25", status: "pending",
  syncStatus: "local", source: { type: "manual" }, createdAt: time,
  updatedAt: time, snoozeCount: 0, ...patch,
});

export const entry = (patch: Record<string, unknown> = {}) => ({
  schemaVersion: 2, id: "entry-1", planId: "plan-1", date: "2026-07-26",
  title: "Entry", contentSummary: "Summary", status: "pending",
  source: { type: "manual" }, createdAt: time, updatedAt: time,
  contentBlocks: [{
    schemaVersion: 2, id: "block-1", kind: "fitness", title: "Moves",
    format: "json", data: {},
  }],
  ...patch,
});

export const cycle = (patch: Record<string, unknown> = {}) => ({
  schemaVersion: 2, id: "plan-1", title: "Plan", topic: "Fitness",
  description: "Week", status: "active", source: { type: "manual" },
  entries: [entry()], createdAt: time, updatedAt: time, ...patch,
});

export const legacy = (todos = [todo()], cyclePlans = [cycle()]) => ({
  schemaVersion: 1 as const,
  todos,
  cyclePlans,
  settings: { launchAtLogin: true },
  updatedAt: time,
});

export function snapshotFor(batch: PlanApiMutationBatch) {
  const creates = batch.operations.filter(
    (item): item is Extract<typeof item, { type: "task.create" }> => item.type === "task.create",
  );
  return structuredClone({
    serverRevision: 2,
    tasks: creates.map((item, taskIndex) => ({
      id: `task-${taskIndex}`, ...item.draft, version: 1, created_at: time, updated_at: time,
      entries: item.draft.entries.map((draft, entryIndex) => ({
        id: `entry-${taskIndex}-${entryIndex}`, task_id: `task-${taskIndex}`,
        ...draft, version: 1, created_at: time, updated_at: time,
      })),
    })),
  });
}

export function resultFor(batch: PlanApiMutationBatch) {
  const snapshot = snapshotFor(batch);
  return {
    serverRevision: 2,
    changedTaskIds: snapshot.tasks.map((task) => task.id),
    changedEntryIds: snapshot.tasks.flatMap((task) => task.entries.map((item) => item.id)),
  };
}

export function setup(
  options: {
    state?: any;
    initial?: any;
    failOnce?: boolean;
    after?: (batch: PlanApiMutationBatch) => any;
    result?: (batch: PlanApiMutationBatch) => any;
    record?: any;
  } = {},
) {
  let saved = options.record ?? null;
  let submitted: PlanApiMutationBatch | undefined;
  let calls = 0;
  const legacyState = { getSnapshot: vi.fn(() => options.state ?? legacy()) };
  const fileStore = {
    loadRecord: vi.fn(async () => saved),
    backupLegacy: vi.fn(async () => "backup.json"),
    saveRecord: vi.fn(async (record) => { saved = record; }),
  };
  const client = {
    snapshot: vi.fn(async () => submitted
      ? (options.after?.(submitted) ?? snapshotFor(submitted))
      : (options.initial ?? { serverRevision: 1, tasks: [] as any[] })),
    mutate: vi.fn(async (batch: PlanApiMutationBatch) => {
      submitted = batch;
      calls += 1;
      if (options.failOnce && calls === 1) throw new Error("network");
      return options.result?.(batch) ?? resultFor(batch);
    }),
  };
  return {
    legacyState,
    fileStore,
    client,
    service: new PlanApiMigrationService({
      legacyState,
      client,
      fileStore,
      now: () => new Date("2026-07-25T02:00:00.000Z"),
    }),
  };
}
