export interface PlanApiContentField { key: string; label: string; type: string; value: unknown }
export interface PlanApiContentItem { title: string; fields: PlanApiContentField[] }
export interface PlanApiContentSection {
  id: string; label: string; layout: "fields" | "list" | "markdown" | "table";
  fields: PlanApiContentField[]; items: PlanApiContentItem[]
}
export interface PlanApiContentDocument {
  schemaVersion: 1; kind: string; title: string; summary: string; locale: string;
  sections: PlanApiContentSection[]
}
export interface PlanApiTaskEntryView {
  id: string; task_id: string; scheduled_date: string;
  status: "pending" | "completed" | "skipped"; content: PlanApiContentDocument;
  source: "manual" | "rule_generated" | "hermes"; slot_key: string | null;
  is_overridden: boolean; generation_revision: number | null; version: number;
  created_at: string; updated_at: string; completed_at: string | null
}
export interface PlanApiTaskView {
  id: string; kind: "daily" | "cycle"; status: "active" | "paused" | "archived";
  generation_mode: "fixed" | "rolling"; content: PlanApiContentDocument;
  schedule_rule: Record<string, unknown> | null; generated_through_date: string | null;
  rule_revision: number; version: number; created_at: string; updated_at: string;
  entries: PlanApiTaskEntryView[]
}
export interface PlanApiSnapshot { serverRevision: number; tasks: PlanApiTaskView[] }
export interface PlanApiTaskEntryDraft {
  scheduled_date: string; status: PlanApiTaskEntryView["status"];
  content: PlanApiContentDocument; source: PlanApiTaskEntryView["source"];
  slot_key: string | null; is_overridden: boolean; generation_revision: number | null;
  completed_at: string | null
}
export type PlanApiMutationOperation =
  | { type: "task.create"; draft: { kind: PlanApiTaskView["kind"]; status: PlanApiTaskView["status"]; generation_mode: PlanApiTaskView["generation_mode"]; content: PlanApiContentDocument; schedule_rule: Record<string, unknown> | null; generated_through_date: string | null; rule_revision: number; entries: PlanApiTaskEntryDraft[] } }
  | { type: "task.update"; targetId: string; expectedVersion: number; patch: Record<string, unknown> }
  | { type: "task.setStatus"; targetId: string; expectedVersion: number; status: PlanApiTaskView["status"] }
  | { type: "task.delete"; targetId: string; expectedVersion: number }
  | { type: "entry.create"; taskId: string; draft: PlanApiTaskEntryDraft }
  | { type: "entry.update"; targetId: string; expectedVersion: number; patch: Record<string, unknown> }
  | { type: "entry.complete" | "entry.reopen" | "entry.skip" | "entry.delete"; targetId: string; expectedVersion: number };
export interface PlanApiMutationBatch {
  idempotencyKey: string;
  expectedServerRevision?: number;
  operations: PlanApiMutationOperation[];
}
export interface PlanApiMutationResult { serverRevision: number; changedTaskIds: string[]; changedEntryIds: string[] }
export interface PlanApiHealth { status: "ok"; service: "plan-api"; apiVersion: 1; database: { status: "ok" }; serverRevision: number }

const invalid = () => new Error("Plan API 快照格式无效");
const record = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw invalid();
  return value as Record<string, unknown>;
};
const keys = (value: Record<string, unknown>, allowed: string[]) => {
  if (Object.keys(value).some((key) => !allowed.includes(key))) throw invalid();
};
const stringValue = (value: unknown) => { if (typeof value !== "string") throw invalid(); return value };
const integer = (value: unknown) => { if (typeof value !== "number" || !Number.isInteger(value)) throw invalid(); return value };
const nonNegative = (value: unknown) => { const n = integer(value); if (n < 0) throw invalid(); return n };
const nullable = <T>(value: unknown, parse: (value: unknown) => T): T | null => value === null ? null : parse(value);
const oneOf = <T extends string>(value: unknown, values: readonly T[]) => { const v = stringValue(value); if (!values.includes(v as T)) throw invalid(); return v as T };
const array = <T>(value: unknown, parse: (value: unknown) => T) => { if (!Array.isArray(value)) throw invalid(); return value.map(parse) };

const parseField = (value: unknown): PlanApiContentField => {
  const v = record(value); keys(v, ["key", "label", "type", "value"]);
  return { key: stringValue(v.key), label: stringValue(v.label), type: stringValue(v.type), value: v.value };
};
const parseItem = (value: unknown): PlanApiContentItem => {
  const v = record(value); keys(v, ["title", "fields"]);
  return { title: stringValue(v.title), fields: array(v.fields, parseField) };
};
const parseSection = (value: unknown): PlanApiContentSection => {
  const v = record(value); keys(v, ["id", "label", "layout", "fields", "items"]);
  return { id: stringValue(v.id), label: stringValue(v.label), layout: oneOf(v.layout, ["fields", "list", "markdown", "table"]), fields: array(v.fields, parseField), items: array(v.items, parseItem) };
};
const parseContent = (value: unknown): PlanApiContentDocument => {
  const v = record(value); keys(v, ["schemaVersion", "kind", "title", "summary", "locale", "sections"]);
  if (v.schemaVersion !== 1) throw invalid();
  return { schemaVersion: 1, kind: stringValue(v.kind), title: stringValue(v.title), summary: stringValue(v.summary), locale: stringValue(v.locale), sections: array(v.sections, parseSection) };
};
const parseEntry = (value: unknown): PlanApiTaskEntryView => {
  const v = record(value); keys(v, ["id", "task_id", "scheduled_date", "status", "content", "source", "slot_key", "is_overridden", "generation_revision", "version", "created_at", "updated_at", "completed_at"]);
  if (typeof v.is_overridden !== "boolean") throw invalid();
  return { id: stringValue(v.id), task_id: stringValue(v.task_id), scheduled_date: stringValue(v.scheduled_date), status: oneOf(v.status, ["pending", "completed", "skipped"]), content: parseContent(v.content), source: oneOf(v.source, ["manual", "rule_generated", "hermes"]), slot_key: nullable(v.slot_key, stringValue), is_overridden: v.is_overridden, generation_revision: nullable(v.generation_revision, integer), version: integer(v.version), created_at: stringValue(v.created_at), updated_at: stringValue(v.updated_at), completed_at: nullable(v.completed_at, stringValue) };
};
const parseTask = (value: unknown): PlanApiTaskView => {
  const v = record(value); keys(v, ["id", "kind", "status", "generation_mode", "content", "schedule_rule", "generated_through_date", "rule_revision", "version", "created_at", "updated_at", "entries"]);
  return { id: stringValue(v.id), kind: oneOf(v.kind, ["daily", "cycle"]), status: oneOf(v.status, ["active", "paused", "archived"]), generation_mode: oneOf(v.generation_mode, ["fixed", "rolling"]), content: parseContent(v.content), schedule_rule: nullable(v.schedule_rule, (item) => record(item)), generated_through_date: nullable(v.generated_through_date, stringValue), rule_revision: nonNegative(v.rule_revision), version: integer(v.version), created_at: stringValue(v.created_at), updated_at: stringValue(v.updated_at), entries: array(v.entries, parseEntry) };
};
export function parsePlanApiSnapshot(value: unknown): PlanApiSnapshot {
  const v = record(value); keys(v, ["serverRevision", "tasks"]);
  return { serverRevision: nonNegative(v.serverRevision), tasks: array(v.tasks, parseTask) };
}
export function parsePlanApiHealth(value: unknown): PlanApiHealth {
  const v = record(value); keys(v, ["status", "service", "apiVersion", "database", "serverRevision"]); const db = record(v.database); keys(db, ["status"]);
  if (v.status !== "ok" || v.service !== "plan-api" || v.apiVersion !== 1 || db.status !== "ok") throw invalid();
  return { status: "ok", service: "plan-api", apiVersion: 1, database: { status: "ok" }, serverRevision: nonNegative(v.serverRevision) };
}
export function parsePlanApiMutationResult(value: unknown): PlanApiMutationResult {
  const v = record(value); keys(v, ["serverRevision", "changedTaskIds", "changedEntryIds"]);
  return { serverRevision: nonNegative(v.serverRevision), changedTaskIds: array(v.changedTaskIds, stringValue), changedEntryIds: array(v.changedEntryIds, stringValue) };
}
