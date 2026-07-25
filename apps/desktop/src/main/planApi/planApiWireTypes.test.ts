import { describe, expect, it } from "vitest";
import {
  parsePlanApiHealth,
  parsePlanApiMutationResult,
  parsePlanApiSnapshot,
} from "./planApiWireTypes.js";

const content = (kind = "todo.unknown") => ({
  schemaVersion: 1,
  kind,
  title: "训练",
  summary: "训练计划",
  locale: "zh-CN",
  sections: [{
    id: "main", label: "主项", layout: "fields",
    fields: [{ key: "duration", label: "时长", type: "text", value: 30 }],
    items: [],
  }],
});

const entry = (overrides: Record<string, unknown> = {}) => ({
  id: "entry_1", task_id: "task_1", scheduled_date: "2026-07-25",
  status: "pending", content: content(), source: "manual", slot_key: null,
  is_overridden: false, generation_revision: null, version: 1,
  created_at: "2026-07-25T01:00:00Z", updated_at: "2026-07-25T01:00:00Z",
  completed_at: null, ...overrides,
});

const snapshot = (overrides: Record<string, unknown> = {}) => ({
  serverRevision: 1,
  tasks: [{
    id: "task_1", kind: "daily", status: "active", generation_mode: "fixed",
    content: content(), schedule_rule: null, generated_through_date: null,
    rule_revision: 1, version: 1, created_at: "2026-07-25T01:00:00Z",
    updated_at: "2026-07-25T01:00:00Z", entries: [entry()], ...overrides,
  }],
});

describe("parsePlanApiSnapshot", () => {
  it("rejects a task without an entry version", () => {
    expect(() => parsePlanApiSnapshot(snapshot({ entries: [entry({ version: undefined })] })))
      .toThrow("Plan API 快照格式无效");
  });

  it("preserves unknown content kinds and valid wire values", () => {
    const value = parsePlanApiSnapshot(snapshot());
    expect(value.tasks[0]?.content.kind).toBe("todo.unknown");
    expect(value.tasks[0]?.entries[0]?.content.sections[0]?.fields[0]?.value).toBe(30);
  });

  it("rejects unknown fields, invalid enums, non-integers, and non-arrays", () => {
    expect(() => parsePlanApiSnapshot({ ...snapshot(), extra: true })).toThrow();
    expect(() => parsePlanApiSnapshot(snapshot({ status: "done" }))).toThrow();
    expect(() => parsePlanApiSnapshot({ ...snapshot(), serverRevision: 1.5 })).toThrow();
    expect(() => parsePlanApiSnapshot({ ...snapshot(), tasks: {} })).toThrow();
  });
});

describe("parsePlanApiHealth and parsePlanApiMutationResult", () => {
  it("parse strict health and mutation result contracts", () => {
    expect(parsePlanApiHealth({
      status: "ok", service: "plan-api", apiVersion: 1,
      database: { status: "ok" }, serverRevision: 2,
    }).serverRevision).toBe(2);
    expect(parsePlanApiMutationResult({
      serverRevision: 3, changedTaskIds: ["task_1"], changedEntryIds: [],
    }).changedTaskIds).toEqual(["task_1"]);
    expect(() => parsePlanApiHealth({
      status: "ok", service: "plan-api", apiVersion: 1,
      database: { status: "ok" }, serverRevision: 2, token: "secret",
    })).toThrow();
  });
});
