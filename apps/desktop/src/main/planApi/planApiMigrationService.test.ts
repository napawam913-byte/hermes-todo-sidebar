import { describe, expect, it } from "vitest";
import { PlanApiMigrationError } from "./planApiMigrationService.js";
import {
  cycle,
  entry,
  legacy,
  resultFor,
  setup,
  snapshotFor,
  time,
  todo,
} from "./planApiMigrationService.testHelpers.js";

describe("PlanApiMigrationService", () => {
  it("freezes once, journals before mutate, and completes after exact verification", async () => {
    const plan = setup();
    await expect(plan.service.migrate()).resolves.toMatchObject({ status: "completed" });
    expect(plan.legacyState.getSnapshot).toHaveBeenCalledOnce();
    expect(plan.fileStore.backupLegacy.mock.invocationCallOrder[0])
      .toBeLessThan(plan.client.mutate.mock.invocationCallOrder[0]);
    expect(plan.fileStore.saveRecord.mock.calls.map(([item]) => item.status))
      .toEqual(["pending", "completed"]);
    expect(plan.client.mutate.mock.calls[0][0].idempotencyKey)
      .toMatch(/^desktop-migration:[a-f0-9]{64}$/);
    expect(plan.client.mutate.mock.calls[0][0].expectedServerRevision).toBe(1);
  });

  it("recovers a pending mutation with its original idempotency key", async () => {
    const plan = setup({ failOnce: true });
    await expect(plan.service.migrate()).rejects.toThrow("network");
    expect(plan.fileStore.saveRecord.mock.calls[0][0].status).toBe("pending");
    plan.legacyState.getSnapshot.mockClear();
    await expect(plan.service.migrate()).resolves.toMatchObject({ status: "completed" });
    expect(plan.legacyState.getSnapshot).toHaveBeenCalledOnce();
    expect(plan.client.mutate.mock.calls[1][0].idempotencyKey)
      .toBe(plan.client.mutate.mock.calls[0][0].idempotencyKey);
  });

  it("fails closed when a pending journal no longer matches the legacy snapshot", async () => {
    const plan = setup({ failOnce: true });
    await expect(plan.service.migrate()).rejects.toThrow("network");
    plan.legacyState.getSnapshot.mockReturnValue(legacy([todo({ title: "changed" })], [cycle()]));
    await expect(plan.service.migrate()).resolves.toEqual({ status: "blocked", reason: "legacy_changed" });
    expect(plan.client.mutate).toHaveBeenCalledOnce();
  });

  it("keeps a pending migration when an uncommitted retry sees a newer remote", async () => {
    const plan = setup({ failOnce: true });
    await expect(plan.service.migrate()).rejects.toThrow("network");
    plan.client.mutate.mockImplementationOnce(async (batch) => {
      expect(batch.expectedServerRevision).toBe(1);
      throw new Error("version_conflict");
    });
    await expect(plan.service.migrate()).rejects.toThrow("version_conflict");
    expect(plan.fileStore.saveRecord.mock.calls.at(-1)?.[0].status).toBe("pending");
  });

  it("preserves legacy status, source, and completion time in the wire batch", async () => {
    const plan = setup({
      state: legacy(
        [todo({ status: "completed", source: { type: "ai_draft" }, completedAt: time })],
        [cycle({
          status: "draft",
          entries: [
            entry({ status: "candidate", source: { type: "manual" } }),
            entry({ id: "entry-2", status: "completed", source: { type: "ai_draft" }, completedAt: time }),
          ],
        })],
      ),
    });
    await plan.service.migrate();
    const creates = plan.client.mutate.mock.calls[0][0].operations.filter(
      (item: any) => item.type === "task.create",
    );
    expect(creates[0].draft.entries[0]).toMatchObject({ status: "completed", source: "hermes", completed_at: time });
    expect(creates[1].draft.status).toBe("paused");
    expect(creates[1].draft.entries).toMatchObject([
      { status: "skipped", source: "manual" },
      { status: "completed", source: "hermes", completed_at: time },
    ]);
  });

  it("rejects changed-ID, duplicate-ID, and content mismatches without overwriting pending", async () => {
    const ids = setup({ result: (batch) => ({ ...resultFor(batch), changedTaskIds: ["missing", "task-1"] }) });
    await expect(ids.service.migrate()).rejects.toEqual(expect.objectContaining<Partial<PlanApiMigrationError>>({
      code: "migration_verification_failed",
    }));
    expect(ids.fileStore.saveRecord.mock.calls.at(-1)?.[0].status).toBe("pending");
    const duplicates = setup({ result: (batch) => ({
      ...resultFor(batch), changedTaskIds: ["task-0", "task-0"], changedEntryIds: ["entry-0-0", "entry-0-0"],
    }) });
    await expect(duplicates.service.migrate()).rejects.toMatchObject({ code: "migration_verification_failed" });
    expect(duplicates.fileStore.saveRecord.mock.calls.at(-1)?.[0].status).toBe("pending");
    const content = setup({ after: (batch) => {
      const snapshot = snapshotFor(batch);
      snapshot.tasks[0].content.title = "wrong";
      return snapshot;
    } });
    await expect(content.service.migrate()).rejects.toMatchObject({ code: "migration_verification_failed" });
    expect(content.fileStore.saveRecord.mock.calls.at(-1)?.[0].status).toBe("pending");
  });

  it("accepts a successful mutation when the verification snapshot is newer", async () => {
    const plan = setup({ after: (batch) => ({ ...snapshotFor(batch), serverRevision: 3 }) });
    await expect(plan.service.migrate()).resolves.toMatchObject({ status: "completed" });
  });

  it("blocks unsafe starts, backs up before skipping, and serializes concurrent work", async () => {
    const busy = setup({ initial: { serverRevision: 9, tasks: [{ id: "remote", entries: [] }] } });
    await expect(busy.service.migrate()).resolves.toEqual({ status: "blocked", reason: "remote_not_empty" });
    await expect(busy.service.keepRemoteAndSkip()).resolves.toMatchObject({ status: "skipped", record: { baselineRevision: 9 } });
    expect(busy.fileStore.backupLegacy).toHaveBeenCalledOnce();
    expect(busy.client.mutate).not.toHaveBeenCalled();
    const empty = setup();
    await expect(empty.service.keepRemoteAndSkip()).resolves.toEqual({ status: "blocked", reason: "remote_empty" });
    const invalid = setup({ state: legacy([{ ...todo(), unknown: true }], []) });
    await expect(invalid.service.migrate()).resolves.toEqual({ status: "blocked", reason: "legacy_invalid" });
    const oversized = setup({ state: legacy(Array.from({ length: 101 }, () => todo()), []) });
    await expect(oversized.service.migrate()).resolves.toEqual({ status: "blocked", reason: "local_limit_exceeded" });
    const concurrent = setup();
    const results = await Promise.all([concurrent.service.migrate(), concurrent.service.keepRemoteAndSkip()]);
    expect(results.map((result) => result.status)).toEqual(["completed", "completed"]);
    expect(concurrent.fileStore.backupLegacy).toHaveBeenCalledOnce();
    expect(concurrent.client.mutate).toHaveBeenCalledOnce();
  });
});
