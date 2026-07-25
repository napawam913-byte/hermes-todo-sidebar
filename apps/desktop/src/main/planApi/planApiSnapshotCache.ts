import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CyclePlan, Todo } from "../../shared/appDomainTypes.js";

export interface PlanApiSnapshotCacheValue {
  schemaVersion: 1;
  serverRevision: number;
  syncedAt: string;
  todos: Todo[];
  cyclePlans: CyclePlan[];
}

const CACHE_FILE_NAME = "plan-api-cache.v1.json";
const TEMP_FILE_NAME = "plan-api-cache.v1.tmp";
const TOP_LEVEL_KEYS = ["schemaVersion", "serverRevision", "syncedAt", "todos", "cyclePlans"];
const CREDENTIAL_KEYS = new Set([
  "token",
  "authorization",
  "password",
  "secret",
  "apikey",
  "access_token",
  "accesstoken",
  "refresh_token",
  "refreshtoken",
  "connectionstring",
]);

export class PlanApiSnapshotCache {
  private readonly cacheFilePath: string;
  private readonly tempFilePath: string;

  constructor(dataDirectory: string) {
    this.cacheFilePath = path.join(dataDirectory, CACHE_FILE_NAME);
    this.tempFilePath = path.join(dataDirectory, TEMP_FILE_NAME);
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

    await mkdir(path.dirname(this.cacheFilePath), { recursive: true });
    try {
      await writeFile(this.tempFilePath, serialized, "utf8");
      await rename(this.tempFilePath, this.cacheFilePath);
    } finally {
      await rm(this.tempFilePath, { force: true });
    }
  }
}

function parseCache(raw: string): PlanApiSnapshotCacheValue {
  const value: unknown = JSON.parse(raw);
  if (!isRecord(value) || Object.keys(value).some((key) => !TOP_LEVEL_KEYS.includes(key))) throw new Error("Invalid cache");
  if (value.schemaVersion !== 1 || !isNonNegativeInteger(value.serverRevision) || typeof value.syncedAt !== "string") {
    throw new Error("Invalid cache");
  }
  if (!isDomainArray(value.todos) || !isDomainArray(value.cyclePlans) || containsCredentialKey(value)) {
    throw new Error("Invalid cache");
  }
  return {
    schemaVersion: 1,
    serverRevision: value.serverRevision,
    syncedAt: value.syncedAt,
    todos: value.todos as Todo[],
    cyclePlans: value.cyclePlans as CyclePlan[],
  };
}

function isDomainArray(value: unknown): value is unknown[] {
  return Array.isArray(value) && value.every(isRecord);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function containsCredentialKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsCredentialKey);
  if (!isRecord(value)) return false;
  return Object.entries(value).some(([key, nested]) => {
    return CREDENTIAL_KEYS.has(key.toLowerCase()) || containsCredentialKey(nested);
  });
}
