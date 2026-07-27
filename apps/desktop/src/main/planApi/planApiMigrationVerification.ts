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
  const actual = result.changedTaskIds.map((id) => project(tasks.get(id)!));
  const desired = expected.map((operation) => project(operation.draft));
  return actual.every(isDefined) && desired.every(isDefined)
    && multiset(actual) === multiset(desired);
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
): string | undefined {
  const entries = task.entries.map(entryProjection);
  if (!entries.every(isDefined)) return undefined;
  return stableJson({
    kind: task.kind,
    status: task.status,
    generation_mode: task.generation_mode,
    content: task.content,
    schedule_rule: task.schedule_rule,
    generated_through_date: task.generated_through_date,
    rule_revision: task.rule_revision,
    entries: entries.sort(compareStable),
  });
}

function entryProjection(entry: PlanApiTaskEntryDraft | PlanApiTaskView["entries"][number]) {
  const completedAt = normalizeCompletedAt(entry.completed_at);
  if (completedAt === undefined) return undefined;
  return {
    scheduled_date: entry.scheduled_date,
    status: entry.status,
    content: entry.content,
    source: entry.source,
    slot_key: entry.slot_key,
    is_overridden: entry.is_overridden,
    generation_revision: entry.generation_revision,
    completed_at: completedAt,
  };
}

function normalizeCompletedAt(value: string | null): string | null | undefined {
  if (value === null) return null;
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!parts) return undefined;
  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  const hour = Number(parts[4]);
  const minute = Number(parts[5]);
  const second = Number(parts[6]);
  const probe = new Date(0);
  probe.setUTCFullYear(year, month - 1, day);
  probe.setUTCHours(hour, minute, second, 0);
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1
    || probe.getUTCDate() !== day || probe.getUTCHours() !== hour
    || probe.getUTCMinutes() !== minute || probe.getUTCSeconds() !== second) return undefined;
  const zone = parts[8]!;
  const zoneHour = zone === "Z" ? 0 : Number(zone.slice(1, 3));
  const zoneMinute = zone === "Z" ? 0 : Number(zone.slice(4, 6));
  if (zoneHour > 14 || zoneMinute > 59 || (zoneHour === 14 && zoneMinute !== 0)) return undefined;
  const sign = zone.startsWith("-") ? -1 : 1;
  const offset = sign * (zoneHour * 60 + zoneMinute) * 60_000;
  const fraction = (parts[7] ?? "").replace(/0+$/, "");
  return `${probe.getTime() - offset}:${fraction}`;
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
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
