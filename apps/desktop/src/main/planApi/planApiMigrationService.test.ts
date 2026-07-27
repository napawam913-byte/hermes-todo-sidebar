import { describe, expect, it, vi } from "vitest";
import { PlanApiMigrationError, PlanApiMigrationService } from "./planApiMigrationService.js";

const time = "2026-07-25T00:00:00.000Z";
const todo = (id = "todo-1") => ({ id, title: "本地待办", date: "2026-07-25", status: "pending", syncStatus: "local", source: { type: "manual" }, createdAt: time, updatedAt: time, snoozeCount: 0 });
const entry = (planId = "plan-1") => ({ schemaVersion: 2, id: "entry-1", planId, date: "2026-07-26", title: "训练", contentSummary: "上肢", contentBlocks: [{ schemaVersion: 2, id: "block-1", kind: "fitness", title: "动作", format: "json", data: {} }], status: "pending", source: { type: "manual" }, createdAt: time, updatedAt: time });
const plan = () => ({ schemaVersion: 2, id: "plan-1", title: "健身", topic: "训练", description: "每周计划", status: "active", source: { type: "manual" }, entries: [entry()], createdAt: time, updatedAt: time });
const legacy = (todos = [todo()], cyclePlans = [plan()]) => ({ schemaVersion: 1 as const, todos, cyclePlans, settings: { launchAtLogin: true }, updatedAt: time });
const remote = (tasks: any[] = []) => ({ serverRevision: 1, tasks });
const imported = () => remote([{ id: "a", entries: [{}] }, { id: "b", entries: [{}] }]);
function setup(options: { state?: any; snapshots?: any[]; mutate?: () => Promise<unknown>; record?: any } = {}) {
  const fileStore = { loadRecord: vi.fn(async () => options.record ?? null), backupLegacy: vi.fn(async () => "backup.json"), saveRecord: vi.fn(async () => undefined) };
  const client = { snapshot: vi.fn(async () => options.snapshots?.shift() ?? remote()), mutate: vi.fn(options.mutate ?? (async () => undefined)) };
  return { fileStore, client, service: new PlanApiMigrationService({ legacyState: { getSnapshot: () => options.state ?? legacy() }, client, fileStore, now: () => new Date("2026-07-25T02:00:00.000Z") }) };
}

describe("PlanApiMigrationService", () => {
  it("backs up before one atomic import and verifies exact task and entry counts", async () => {
    const plan = setup({ snapshots: [remote(), remote(), imported()] });
    await expect(plan.service.migrate()).resolves.toMatchObject({ status: "completed" });
    expect(plan.fileStore.backupLegacy.mock.invocationCallOrder[0]).toBeLessThan(plan.client.mutate.mock.invocationCallOrder[0]);
    expect(plan.client.mutate).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: `desktop-migration:${time}`, operations: expect.arrayContaining([expect.objectContaining({ type: "task.create" })]) }));
    expect(plan.fileStore.saveRecord).toHaveBeenCalledWith(expect.objectContaining({ status: "completed", importedTaskCount: 2, importedEntryCount: 2 }));
  });

  it("blocks a non-empty remote, malformed legacy data, and more than 100 local tasks without mutating", async () => {
    const remoteBusy = setup({ snapshots: [remote([{ id: "remote", entries: [] }])] });
    await expect(remoteBusy.service.inspect()).resolves.toEqual({ status: "blocked", reason: "remote_not_empty" });
    const invalid = setup({ state: legacy([{ ...todo(), unexpected: true }], []) });
    await expect(invalid.service.inspect()).resolves.toEqual({ status: "blocked", reason: "legacy_invalid" });
    const oversized = setup({ state: legacy(Array.from({ length: 101 }, (_, index) => todo(`todo-${index}`)), []) });
    await expect(oversized.service.inspect()).resolves.toEqual({ status: "blocked", reason: "local_limit_exceeded" });
    expect(remoteBusy.client.mutate).not.toHaveBeenCalled(); expect(invalid.client.mutate).not.toHaveBeenCalled(); expect(oversized.client.mutate).not.toHaveBeenCalled();
  });

  it("preserves the backup and never records completion when mutation or verification fails", async () => {
    const failed = setup({ snapshots: [remote(), remote()], mutate: async () => { throw new Error("network"); } });
    await expect(failed.service.migrate()).rejects.toThrow("network");
    expect(failed.fileStore.backupLegacy).toHaveBeenCalledOnce(); expect(failed.fileStore.saveRecord).not.toHaveBeenCalled();
    const mismatch = setup({ snapshots: [remote(), remote(), remote([{ id: "only", entries: [] }])] });
    await expect(mismatch.service.migrate()).rejects.toEqual(expect.objectContaining<Partial<PlanApiMigrationError>>({ code: "migration_verification_failed" }));
    expect(mismatch.fileStore.saveRecord).not.toHaveBeenCalled();
  });

  it("rechecks the remote after backup so a concurrent remote import never receives a mutation", async () => {
    const plan = setup({ snapshots: [remote(), remote([{ id: "other", entries: [] }])] });
    await expect(plan.service.migrate()).resolves.toEqual({ status: "blocked", reason: "remote_not_empty" });
    expect(plan.fileStore.backupLegacy).toHaveBeenCalledOnce(); expect(plan.client.mutate).not.toHaveBeenCalled();
  });

  it("short-circuits completed state and only skips a remote when explicitly requested", async () => {
    const done = { schemaVersion: 1 as const, status: "completed" as const, sourceUpdatedAt: time, backupPath: "backup.json", importedTaskCount: 2, importedEntryCount: 2, completedAt: time };
    const completed = setup({ record: done });
    await expect(completed.service.migrate()).resolves.toMatchObject({ status: "completed" });
    expect(completed.client.snapshot).not.toHaveBeenCalled(); expect(completed.client.mutate).not.toHaveBeenCalled();
    const skipped = setup();
    await expect(skipped.service.keepRemoteAndSkip()).resolves.toMatchObject({ status: "skipped" });
    expect(skipped.fileStore.backupLegacy).not.toHaveBeenCalled(); expect(skipped.client.mutate).not.toHaveBeenCalled();
  });
});
