import type { AppMutationOperation } from "../../shared/appMutationTypes.js";
import { adaptAppMutationBatch } from "./mutationAdapter.js";
import { type FrozenLegacyState } from "./planApiMigrationLegacy.js";
import { PlanApiVersionIndex } from "./planApiVersionIndex.js";
import type { PlanApiMutationBatch, PlanApiTaskEntryDraft } from "./planApiWireTypes.js";

type EntryMeta = Pick<PlanApiTaskEntryDraft, "status" | "source" | "completed_at">;

export function createMigrationBatch(
  frozen: FrozenLegacyState,
  idempotencyKey: string,
): PlanApiMutationBatch {
  const batch = adaptAppMutationBatch({
    batch: { source: { type: "manual" }, summary: "legacy state migration", operations: operationsFor(frozen) },
    snapshot: { todos: [], cyclePlans: [] },
    versionIndex: PlanApiVersionIndex.fromSnapshot({ serverRevision: 0, tasks: [] }),
    idempotencyKey,
  });
  const metadata = metadataFor(frozen);
  let taskIndex = 0;
  return {
    ...batch,
    operations: batch.operations.map((operation) => {
      if (operation.type !== "task.create") return operation;
      const entries = operation.draft.entries.map((entry, entryIndex) => ({
        ...entry,
        ...metadata[taskIndex][entryIndex],
      }));
      taskIndex += 1;
      return { ...operation, draft: { ...operation.draft, entries } };
    }),
  };
}

function operationsFor(frozen: FrozenLegacyState): AppMutationOperation[] {
  return [
    ...frozen.todos.map((todo) => ({
      type: "todo.create" as const,
      draft: { title: todo.title, date: todo.date, ...(todo.notes !== undefined ? { notes: todo.notes } : {}) },
    })),
    ...frozen.cyclePlans.map((plan) => ({
      type: "cyclePlan.create" as const,
      draft: {
        title: plan.title,
        topic: plan.topic,
        description: plan.description,
        status: plan.status,
        entries: plan.entries.map((entry) => ({
          date: entry.date,
          title: entry.title,
          contentSummary: entry.contentSummary,
          contentBlocks: entry.contentBlocks.map(({ kind, title, format, data }) => ({ kind, title, format, data })),
        })),
      },
    })),
  ];
}

function metadataFor(frozen: FrozenLegacyState): EntryMeta[][] {
  return [
    ...frozen.todos.map((todo) => [{
      status: todo.status,
      source: apiSource(todo.source.type),
      completed_at: todo.completedAt ?? null,
    }]),
    ...frozen.cyclePlans.map((plan) => plan.entries.map((entry) => ({
      status: entry.status === "candidate" ? "skipped" : entry.status,
      source: apiSource(entry.source.type),
      completed_at: entry.completedAt ?? null,
    }))),
  ];
}

function apiSource(source: string): "manual" | "hermes" {
  return source === "manual" ? "manual" : "hermes";
}
