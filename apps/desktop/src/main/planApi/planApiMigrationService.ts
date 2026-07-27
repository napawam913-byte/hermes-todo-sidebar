/** 模块用途：将旧 state.v1.json 在备份后一次性导入 Plan API，且只在校验成功后留痕。 */
import type { CyclePlan, CyclePlanEntry, PlanContentBlock, Todo } from "../../shared/appDomainTypes.js";
import type { AppMutationOperation } from "../../shared/appMutationTypes.js";
import type { StoredAppStateV1 } from "../storage/appStateTypes.js";
import { adaptAppMutationBatch } from "./mutationAdapter.js";
import { PlanApiMigrationFileStore, type PlanApiMigrationRecordV1 } from "./planApiMigrationFileStore.js";
import { PlanApiVersionIndex } from "./planApiVersionIndex.js";
import type { PlanApiMutationBatch, PlanApiSnapshot } from "./planApiWireTypes.js";

type Client = { snapshot(): Promise<PlanApiSnapshot>; mutate(batch: PlanApiMutationBatch): Promise<unknown> };
type LegacySource = { getSnapshot(): StoredAppStateV1 };
export type PlanApiMigrationInspection =
  | { status: "completed" | "skipped"; record: PlanApiMigrationRecordV1 }
  | { status: "ready"; taskCount: number; entryCount: number }
  | { status: "blocked"; reason: "remote_not_empty" | "legacy_empty" | "legacy_invalid" | "local_limit_exceeded" };

export class PlanApiMigrationError extends Error {
  constructor(readonly code: "migration_not_ready" | "migration_verification_failed") {
    super(code);
    this.name = "PlanApiMigrationError";
  }
}

export interface PlanApiMigrationDependencies {
  legacyState: LegacySource;
  client: Client;
  fileStore: Pick<PlanApiMigrationFileStore, "loadRecord" | "backupLegacy" | "saveRecord">;
  now?: () => Date;
}

export class PlanApiMigrationService {
  private tail: Promise<void> = Promise.resolve();
  private readonly now: () => Date;

  constructor(private readonly deps: PlanApiMigrationDependencies) { this.now = deps.now ?? (() => new Date()); }

  async inspect(): Promise<PlanApiMigrationInspection> {
    const record = await this.deps.fileStore.loadRecord();
    if (record) return { status: record.status, record };
    const legacy = parseLegacy(this.deps.legacyState.getSnapshot());
    if (!legacy) return { status: "blocked", reason: "legacy_invalid" };
    const taskCount = legacy.todos.length + legacy.cyclePlans.length;
    const entryCount = legacy.todos.length + legacy.cyclePlans.reduce((sum, plan) => sum + plan.entries.length, 0);
    if (!taskCount) return { status: "blocked", reason: "legacy_empty" };
    if (taskCount > 100) return { status: "blocked", reason: "local_limit_exceeded" };
    const remote = await this.deps.client.snapshot();
    if (remote.tasks.length) return { status: "blocked", reason: "remote_not_empty" };
    return { status: "ready", taskCount, entryCount };
  }

  async migrate(): Promise<PlanApiMigrationInspection> {
    return this.enqueue(async () => {
      const result = await this.inspect();
      if (result.status !== "ready") return result;
      const legacy = parseLegacy(this.deps.legacyState.getSnapshot());
      if (!legacy) return { status: "blocked", reason: "legacy_invalid" };
      const backupPath = await this.deps.fileStore.backupLegacy();
      const before = await this.deps.client.snapshot();
      if (before.tasks.length) return { status: "blocked", reason: "remote_not_empty" };
      const operations = toOperations(legacy);
      const batch = adaptAppMutationBatch({
        batch: { source: { type: "manual" }, summary: "legacy state migration", operations },
        snapshot: { todos: [], cyclePlans: [] }, versionIndex: PlanApiVersionIndex.fromSnapshot({ serverRevision: 0, tasks: [] }),
        idempotencyKey: `desktop-migration:${legacy.updatedAt}`,
      });
      await this.deps.client.mutate(batch);
      const remote = await this.deps.client.snapshot();
      const beforeEntries = before.tasks.reduce((sum, task) => sum + task.entries.length, 0);
      const expectedEntries = beforeEntries + result.entryCount;
      const actualEntries = remote.tasks.reduce((sum, task) => sum + task.entries.length, 0);
      if (remote.tasks.length !== before.tasks.length + result.taskCount || actualEntries !== expectedEntries) {
        throw new PlanApiMigrationError("migration_verification_failed");
      }
      const record: PlanApiMigrationRecordV1 = {
        schemaVersion: 1, status: "completed", sourceUpdatedAt: legacy.updatedAt, backupPath,
        importedTaskCount: result.taskCount, importedEntryCount: result.entryCount, completedAt: this.now().toISOString(),
      };
      await this.deps.fileStore.saveRecord(record);
      return { status: "completed", record };
    });
  }

  async keepRemoteAndSkip(): Promise<PlanApiMigrationInspection> {
    return this.enqueue(async () => {
      const record = await this.deps.fileStore.loadRecord();
      if (record) return { status: record.status, record };
      const legacy = parseLegacy(this.deps.legacyState.getSnapshot());
      if (!legacy) return { status: "blocked", reason: "legacy_invalid" };
      const recordValue: PlanApiMigrationRecordV1 = {
        schemaVersion: 1, status: "skipped", sourceUpdatedAt: legacy.updatedAt, backupPath: "",
        importedTaskCount: 0, importedEntryCount: 0, completedAt: this.now().toISOString(),
      };
      await this.deps.fileStore.saveRecord(recordValue);
      return { status: "skipped", record: recordValue };
    });
  }

  private enqueue<T>(job: () => Promise<T>): Promise<T> {
    const result = this.tail.then(job); this.tail = result.then(() => undefined, () => undefined); return result;
  }
}

function toOperations(legacy: { todos: Todo[]; cyclePlans: CyclePlan[] }): AppMutationOperation[] {
  return [
    ...legacy.todos.map((todo) => ({ type: "todo.create" as const, draft: { title: todo.title, date: todo.date, ...(todo.notes ? { notes: todo.notes } : {}) } })),
    ...legacy.cyclePlans.map((plan) => ({ type: "cyclePlan.create" as const, draft: {
      title: plan.title, topic: plan.topic, description: plan.description, status: plan.status,
      entries: plan.entries.map((entry) => ({ date: entry.date, title: entry.title, contentSummary: entry.contentSummary,
        contentBlocks: entry.contentBlocks.map(({ kind, title, format, data }) => ({ kind, title, format, data })) })),
    } })),
  ];
}

function parseLegacy(value: StoredAppStateV1): { todos: Todo[]; cyclePlans: CyclePlan[]; updatedAt: string } | null {
  try {
    if (!Array.isArray(value.todos) || !Array.isArray(value.cyclePlans) || typeof value.updatedAt !== "string") return null;
    return { todos: value.todos.map(parseTodo), cyclePlans: value.cyclePlans.map(parsePlan), updatedAt: value.updatedAt };
  } catch { return null; }
}
function parseTodo(value: unknown): Todo {
  const todo = strict(value, ["id", "title", "date", "status", "syncStatus", "source", "createdAt", "updatedAt", "snoozeCount"], ["notes", "remindAt", "completedAt"]);
  if (!strings(todo, ["id", "title", "date", "createdAt", "updatedAt"]) || !one(todo.status, ["pending", "completed"])
    || !one(todo.syncStatus, ["local", "queued", "synced", "failed"]) || !source(todo.source) || !count(todo.snoozeCount)
    || !optionalStrings(todo, ["notes", "remindAt", "completedAt"])) throw new Error("invalid");
  return todo as unknown as Todo;
}
function parsePlan(value: unknown): CyclePlan {
  const plan = strict(value, ["schemaVersion", "id", "title", "topic", "description", "status", "source", "entries", "createdAt", "updatedAt"], []);
  if (plan.schemaVersion !== 2 || !strings(plan, ["id", "title", "topic", "description", "createdAt", "updatedAt"])
    || !one(plan.status, ["draft", "active", "paused", "archived"]) || !source(plan.source) || !Array.isArray(plan.entries)) throw new Error("invalid");
  const entries = plan.entries.map(parseEntry); if (entries.some((entry) => entry.planId !== plan.id)) throw new Error("invalid");
  return { ...plan, entries } as unknown as CyclePlan;
}
function parseEntry(value: unknown): CyclePlanEntry {
  const entry = strict(value, ["schemaVersion", "id", "planId", "date", "title", "contentSummary", "contentBlocks", "status", "source", "createdAt", "updatedAt"], ["completedAt"]);
  if (entry.schemaVersion !== 2 || !strings(entry, ["id", "planId", "date", "title", "contentSummary", "createdAt", "updatedAt"])
    || !one(entry.status, ["candidate", "pending", "completed", "skipped"]) || !source(entry.source)
    || !optionalStrings(entry, ["completedAt"]) || !Array.isArray(entry.contentBlocks)) throw new Error("invalid");
  return { ...entry, contentBlocks: entry.contentBlocks.map(parseBlock) } as unknown as CyclePlanEntry;
}
function parseBlock(value: unknown): PlanContentBlock {
  const block = strict(value, ["schemaVersion", "id", "kind", "title", "format", "data"], []);
  if (block.schemaVersion !== 2 || !strings(block, ["id", "kind", "title"]) || !one(block.format, ["json", "markdown"])
    || !isJson(block.data)) throw new Error("invalid"); return block as unknown as PlanContentBlock;
}
function strict(value: unknown, required: string[], optional: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid");
  const record = value as Record<string, unknown>; const allowed = new Set([...required, ...optional]);
  if (!required.every((key) => key in record) || Object.keys(record).some((key) => !allowed.has(key))) throw new Error("invalid"); return record;
}
function strings(value: Record<string, unknown>, keys: string[]): boolean { return keys.every((key) => typeof value[key] === "string"); }
function optionalStrings(value: Record<string, unknown>, keys: string[]): boolean { return keys.every((key) => !(key in value) || typeof value[key] === "string"); }
function count(value: unknown): boolean { return typeof value === "number" && Number.isInteger(value) && value >= 0; }
function one(value: unknown, values: string[]): boolean { return typeof value === "string" && values.includes(value); }
function source(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entry = value as Record<string, unknown>; const allowed = new Set(["type", "proposalId", "externalId"]);
  return one(entry.type, ["manual", "ai_draft", "hermes", "feishu"]) && Object.keys(entry).every((key) => allowed.has(key))
    && optionalStrings(entry, ["proposalId", "externalId"]);
}
function isJson(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value) && Object.values(value).every(jsonValue);
}
function jsonValue(value: unknown): boolean { return value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number" && Number.isFinite(value) || Array.isArray(value) && value.every(jsonValue) || isJson(value); }
