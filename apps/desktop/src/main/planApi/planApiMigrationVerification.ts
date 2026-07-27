import type { PlanApiMigrationRecordV1 } from "./planApiMigrationFileStore.js";
import type {
  PlanApiMutationBatch,
  PlanApiMutationResult,
  PlanApiSnapshot,
  PlanApiTaskEntryDraft,
  PlanApiTaskView,
} from "./planApiWireTypes.js";

export function migrationCommitIsVerified(
  result: PlanApiMutationResult,
  snapshot: PlanApiSnapshot,
  batch: PlanApiMutationBatch,
  record: PlanApiMigrationRecordV1,
): boolean {
  const expected = batch.operations.filter(isTaskCreate);
  if (hasDuplicates(result.changedTaskIds) || hasDuplicates(result.changedEntryIds)) return false;
  if (result.changedTaskIds.length !== expected.length
    || result.changedEntryIds.length !== record.importedEntryCount
    || result.serverRevision <= record.baselineRevision
    || snapshot.serverRevision < result.serverRevision) return false;
  const tasks = new Map(snapshot.tasks.map((task) => [task.id, task]));
  const entryTaskIds = new Map(snapshot.tasks.flatMap((task) =>
    task.entries.map((entry) => [entry.id, task.id] as const)));
  if (result.changedTaskIds.some((id) => !tasks.has(id))
    || result.changedEntryIds.some((id) => !result.changedTaskIds.includes(entryTaskIds.get(id) ?? ""))) return false;
  return multiset(result.changedTaskIds.map((id) => project(tasks.get(id)!)))
    === multiset(expected.map((operation) => project(operation.draft)));
}

function isTaskCreate(
  operation: PlanApiMutationBatch["operations"][number],
): operation is Extract<PlanApiMutationBatch["operations"][number], { type: "task.create" }> {
  return operation.type === "task.create";
}

function hasDuplicates(values: string[]): boolean {
  return new Set(values).size !== values.length;
}

function project(
  task: PlanApiTaskView | Extract<PlanApiMutationBatch["operations"][number], { type: "task.create" }>["draft"],
): string {
  return stableJson({
    kind: task.kind,
    status: task.status,
    generation_mode: task.generation_mode,
    content: task.content,
    schedule_rule: task.schedule_rule,
    generated_through_date: task.generated_through_date,
    rule_revision: task.rule_revision,
    entries: task.entries.map(entryProjection).sort(compareStable),
  });
}

function entryProjection(entry: PlanApiTaskEntryDraft | PlanApiTaskView["entries"][number]) {
  return {
    scheduled_date: entry.scheduled_date,
    status: entry.status,
    content: entry.content,
    source: entry.source,
    slot_key: entry.slot_key,
    is_overridden: entry.is_overridden,
    generation_revision: entry.generation_revision,
    completed_at: entry.completed_at,
  };
}

function multiset(values: string[]): string {
  return values.sort().join("\n");
}

function compareStable(left: unknown, right: unknown): number {
  return stableJson(left).localeCompare(stableJson(right));
}

function stableJson(value: unknown): string {
  if (value === null || ["boolean", "number", "string"].includes(typeof value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const item = value as Record<string, unknown>;
  return `{${Object.keys(item).sort().map((key) => `${JSON.stringify(key)}:${stableJson(item[key])}`).join(",")}}`;
}
