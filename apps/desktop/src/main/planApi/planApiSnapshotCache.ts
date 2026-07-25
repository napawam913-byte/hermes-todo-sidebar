import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CyclePlan, CyclePlanEntry, DataSource, PlanContentBlock, Todo } from "../../shared/appDomainTypes.js";

export interface PlanApiSnapshotCacheValue {
  schemaVersion: 1;
  serverRevision: number;
  syncedAt: string;
  todos: Todo[];
  cyclePlans: CyclePlan[];
}

const CACHE_FILE_NAME = "plan-api-cache.v1.json";
const TOP_LEVEL_KEYS = ["schemaVersion", "serverRevision", "syncedAt", "todos", "cyclePlans"];
const invalid = () => new Error("Invalid cache");
const oneOf = <T extends string>(value: unknown, values: readonly T[]): T => {
  if (typeof value !== "string" || !values.includes(value as T)) throw invalid();
  return value as T;
};

export class PlanApiSnapshotCache {
  private readonly cacheFilePath: string;
  private saveTail: Promise<void> = Promise.resolve();

  constructor(dataDirectory: string) {
    this.cacheFilePath = path.join(dataDirectory, CACHE_FILE_NAME);
  }

  async load(): Promise<PlanApiSnapshotCacheValue | null> {
    try {
      return parseCache(await readFile(this.cacheFilePath, "utf8"));
    } catch {
      return null;
    }
  }

  async save(snapshot: PlanApiSnapshotCacheValue): Promise<void> {
    const value = parseCache(JSON.stringify({
      schemaVersion: snapshot.schemaVersion,
      serverRevision: snapshot.serverRevision,
      syncedAt: snapshot.syncedAt,
      todos: snapshot.todos,
      cyclePlans: snapshot.cyclePlans,
    }));
    const serialized = `${JSON.stringify(value, null, 2)}\n`;
    const directory = path.dirname(this.cacheFilePath);
    const tempFilePath = path.join(directory, `${CACHE_FILE_NAME}.${randomUUID()}.tmp`);

    const operation = this.saveTail.then(async () => {
      await mkdir(directory, { recursive: true });
      try {
        await writeFile(tempFilePath, serialized, "utf8");
        await rename(tempFilePath, this.cacheFilePath);
      } finally {
        await rm(tempFilePath, { force: true });
      }
    });
    this.saveTail = operation.catch(() => undefined);
    await operation;
  }
}

function parseCache(raw: string): PlanApiSnapshotCacheValue {
  const value: unknown = JSON.parse(raw);
  if (!hasShape(value, TOP_LEVEL_KEYS, TOP_LEVEL_KEYS) || value.schemaVersion !== 1 || !isNonNegativeInteger(value.serverRevision) || typeof value.syncedAt !== "string" || !Array.isArray(value.todos) || !Array.isArray(value.cyclePlans)) throw invalid();
  return {
    schemaVersion: 1,
    serverRevision: value.serverRevision,
    syncedAt: value.syncedAt,
    todos: value.todos.map(parseTodo),
    cyclePlans: value.cyclePlans.map(parseCyclePlan),
  };
}

function parseTodo(value: unknown): Todo {
  if (!hasShape(value, ["id", "title", "date", "status", "syncStatus", "source", "createdAt", "updatedAt", "snoozeCount"], ["notes", "remindAt", "completedAt"]) || typeof value.id !== "string" || typeof value.title !== "string" || typeof value.date !== "string" || typeof value.createdAt !== "string" || typeof value.updatedAt !== "string" || !isNonNegativeInteger(value.snoozeCount)) throw invalid();
  return {
    id: value.id, title: value.title, date: value.date,
    status: oneOf(value.status, ["pending", "completed"]),
    syncStatus: oneOf(value.syncStatus, ["local", "queued", "synced", "failed"]),
    source: parseSource(value.source), createdAt: value.createdAt, updatedAt: value.updatedAt,
    snoozeCount: value.snoozeCount,
    ...(optionalString(value, "notes") ? { notes: value.notes as string } : {}),
    ...(optionalString(value, "remindAt") ? { remindAt: value.remindAt as string } : {}),
    ...(optionalString(value, "completedAt") ? { completedAt: value.completedAt as string } : {}),
  };
}

function parseCyclePlan(value: unknown): CyclePlan {
  if (!hasShape(value, ["schemaVersion", "id", "title", "topic", "description", "status", "source", "entries", "createdAt", "updatedAt"], []) || value.schemaVersion !== 2 || typeof value.id !== "string" || typeof value.title !== "string" || typeof value.topic !== "string" || typeof value.description !== "string" || typeof value.createdAt !== "string" || typeof value.updatedAt !== "string" || !Array.isArray(value.entries)) throw invalid();
  const entries = value.entries.map(parseCyclePlanEntry);
  if (entries.some((entry) => entry.planId !== value.id)) throw invalid();
  return { schemaVersion: 2, id: value.id, title: value.title, topic: value.topic, description: value.description, status: oneOf(value.status, ["draft", "active", "paused", "archived"]), source: parseSource(value.source), entries, createdAt: value.createdAt, updatedAt: value.updatedAt };
}

function parseCyclePlanEntry(value: unknown): CyclePlanEntry {
  if (!hasShape(value, ["schemaVersion", "id", "planId", "date", "title", "contentSummary", "contentBlocks", "status", "source", "createdAt", "updatedAt"], ["completedAt"]) || value.schemaVersion !== 2 || typeof value.id !== "string" || typeof value.planId !== "string" || typeof value.date !== "string" || typeof value.title !== "string" || typeof value.contentSummary !== "string" || typeof value.createdAt !== "string" || typeof value.updatedAt !== "string" || !Array.isArray(value.contentBlocks)) throw invalid();
  return { schemaVersion: 2, id: value.id, planId: value.planId, date: value.date, title: value.title, contentSummary: value.contentSummary, contentBlocks: value.contentBlocks.map(parseContentBlock), status: oneOf(value.status, ["candidate", "pending", "completed", "skipped"]), source: parseSource(value.source), createdAt: value.createdAt, updatedAt: value.updatedAt, ...(optionalString(value, "completedAt") ? { completedAt: value.completedAt as string } : {}) };
}

function parseContentBlock(value: unknown): PlanContentBlock {
  if (!hasShape(value, ["schemaVersion", "id", "kind", "title", "format", "data"], []) || value.schemaVersion !== 2 || typeof value.id !== "string" || typeof value.kind !== "string" || typeof value.title !== "string" || !isJsonObject(value.data)) throw invalid();
  return { schemaVersion: 2, id: value.id, kind: value.kind, title: value.title, format: oneOf(value.format, ["json", "markdown"]), data: value.data };
}

function parseSource(value: unknown): DataSource {
  if (!hasShape(value, ["type"], ["proposalId", "externalId"])) throw invalid();
  return { type: oneOf(value.type, ["manual", "ai_draft", "hermes", "feishu"]), ...(optionalString(value, "proposalId") ? { proposalId: value.proposalId as string } : {}), ...(optionalString(value, "externalId") ? { externalId: value.externalId as string } : {}) };
}

function hasShape(value: unknown, required: readonly string[], optional: readonly string[]): value is Record<string, any> {
  if (!isRecord(value)) return false;
  const allowed = new Set([...required, ...optional]);
  return required.every((key) => key in value) && Object.keys(value).every((key) => allowed.has(key));
}

function optionalString(value: Record<string, unknown>, key: string): boolean {
  if (!(key in value)) return false;
  if (typeof value[key] !== "string") throw invalid();
  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && Object.values(value).every(isJsonValue);
}

function isJsonValue(value: unknown): boolean {
  return value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number" && Number.isFinite(value) || Array.isArray(value) && value.every(isJsonValue) || isJsonObject(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}
