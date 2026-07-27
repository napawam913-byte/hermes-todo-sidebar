import { createHash } from "node:crypto";
import type {
  CyclePlan,
  CyclePlanEntry,
  PlanContentBlock,
  Todo,
} from "../../shared/appDomainTypes.js";
import type { StoredAppStateV1 } from "../storage/appStateTypes.js";

export type FrozenLegacyState = {
  state: StoredAppStateV1;
  todos: Todo[];
  cyclePlans: CyclePlan[];
  fingerprint: string;
  taskCount: number;
  entryCount: number;
};

export function freezeLegacyState(
  value: StoredAppStateV1,
): FrozenLegacyState | null {
  try {
    if (!validState(value)) return null;
    const todos = value.todos.map(parseTodo);
    const cyclePlans = value.cyclePlans.map(parsePlan);
    const state = { ...value, todos, cyclePlans } as StoredAppStateV1;
    const taskCount = todos.length + cyclePlans.length;
    const entryCount = todos.length + cyclePlans.reduce(
      (count, plan) => count + plan.entries.length,
      0,
    );
    return {
      state: structuredClone(state),
      todos,
      cyclePlans,
      taskCount,
      entryCount,
      fingerprint: hash(state),
    };
  } catch {
    return null;
  }
}

function validState(value: StoredAppStateV1): boolean {
  return value.schemaVersion === 1 && typeof value.updatedAt === "string"
    && Array.isArray(value.todos) && Array.isArray(value.cyclePlans)
    && !!value.settings && typeof value.settings.launchAtLogin === "boolean"
    && exact(value as unknown as Record<string, unknown>, [
      "schemaVersion", "todos", "cyclePlans", "settings", "updatedAt",
    ]);
}

function parseTodo(value: unknown): Todo {
  return domain(value, [
    "id", "title", "date", "status", "syncStatus", "source", "createdAt", "updatedAt", "snoozeCount",
  ], ["notes", "remindAt", "completedAt"], (item) =>
    strings(item, ["id", "title", "date", "createdAt", "updatedAt"])
    && one(item.status, ["pending", "completed"])
    && one(item.syncStatus, ["local", "queued", "synced", "failed"])
    && validSource(item.source) && count(item.snoozeCount)
    && optionalStrings(item, ["notes", "remindAt", "completedAt"]));
}

function parsePlan(value: unknown): CyclePlan {
  const plan = domain<CyclePlan>(value, [
    "schemaVersion", "id", "title", "topic", "description", "status", "source", "entries", "createdAt", "updatedAt",
  ], [], (item) => item.schemaVersion === 2
    && strings(item, ["id", "title", "topic", "description", "createdAt", "updatedAt"])
    && one(item.status, ["draft", "active", "paused", "archived"])
    && validSource(item.source) && Array.isArray(item.entries));
  const entries = plan.entries.map(parseEntry);
  if (entries.some((entry) => entry.planId !== plan.id)) throw Error();
  return { ...plan, entries };
}

function parseEntry(value: unknown): CyclePlanEntry {
  const entry = domain<CyclePlanEntry>(value, [
    "schemaVersion", "id", "planId", "date", "title", "contentSummary", "contentBlocks", "status", "source", "createdAt", "updatedAt",
  ], ["completedAt"], (item) => item.schemaVersion === 2
    && strings(item, ["id", "planId", "date", "title", "contentSummary", "createdAt", "updatedAt"])
    && one(item.status, ["candidate", "pending", "completed", "skipped"])
    && validSource(item.source) && optionalStrings(item, ["completedAt"])
    && Array.isArray(item.contentBlocks));
  return { ...entry, contentBlocks: entry.contentBlocks.map(parseBlock) };
}

function parseBlock(value: unknown): PlanContentBlock {
  return domain(value, ["schemaVersion", "id", "kind", "title", "format", "data"], [],
    (item) => item.schemaVersion === 2 && strings(item, ["id", "kind", "title"])
      && one(item.format, ["json", "markdown"]) && jsonObject(item.data));
}

function domain<T>(value: unknown, required: string[], optional: string[], valid: (item: Record<string, unknown>) => boolean): T {
  const item = strict(value, required, optional);
  if (!valid(item)) throw Error();
  return item as unknown as T;
}

function strict(value: unknown, required: string[], optional: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error();
  const item = value as Record<string, unknown>;
  if (!required.every((key) => key in item) || !exact(item, [...required, ...optional])) throw Error();
  return item;
}

function validSource(value: unknown): boolean {
  return !!value && typeof value === "object" && !Array.isArray(value)
    && one((value as Record<string, unknown>).type, ["manual", "ai_draft", "hermes", "feishu"])
    && exact(value as Record<string, unknown>, ["type", "proposalId", "externalId"])
    && optionalStrings(value as Record<string, unknown>, ["proposalId", "externalId"]);
}

function exact(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

function strings(value: Record<string, unknown>, keys: string[]): boolean {
  return keys.every((key) => typeof value[key] === "string");
}

function optionalStrings(value: Record<string, unknown>, keys: string[]): boolean {
  return keys.every((key) => !(key in value) || typeof value[key] === "string");
}

function count(value: unknown): boolean {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function one(value: unknown, values: string[]): boolean {
  return typeof value === "string" && values.includes(value);
}

function jsonObject(value: unknown): boolean {
  return !!value && typeof value === "object" && !Array.isArray(value)
    && Object.values(value).every(jsonValue);
}

function jsonValue(value: unknown): boolean {
  return value === null || typeof value === "string" || typeof value === "boolean"
    || (typeof value === "number" && Number.isFinite(value))
    || (Array.isArray(value) && value.every(jsonValue)) || jsonObject(value);
}

function hash(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function stableJson(value: unknown): string {
  if (value === null || ["boolean", "number", "string"].includes(typeof value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const item = value as Record<string, unknown>;
  return `{${Object.keys(item).sort().map((key) => `${JSON.stringify(key)}:${stableJson(item[key])}`).join(",")}}`;
}
