import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PlanApiMigrationFileStore, PlanApiMigrationStorageError } from "./planApiMigrationFileStore.js";

const dirs: string[] = [];
async function store() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "plan-api-migration-")); dirs.push(directory);
  return { directory, store: new PlanApiMigrationFileStore(directory, () => new Date("2026-07-25T01:02:03.004Z")) };
}
const record = (status: "completed" | "skipped" = "completed") => ({
  schemaVersion: 1 as const, status, sourceUpdatedAt: "2026-07-25T00:00:00.000Z", backupPath: "backup.json",
  importedTaskCount: 2, importedEntryCount: 3, completedAt: "2026-07-25T01:00:00.000Z",
});
afterEach(async () => { await Promise.all(dirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))); });

describe("PlanApiMigrationFileStore", () => {
  it("copies the legacy state to a safe timestamp backup before recording completion", async () => {
    const { directory, store: files } = await store();
    await writeFile(files.legacyStatePath, "{\"state\":true}", "utf8");
    const backupPath = await files.backupLegacy();
    await files.saveRecord({ ...record(), backupPath });

    expect(path.basename(backupPath)).toBe("state.v1.pre-plan-api-2026-07-25T01-02-03-004Z.json");
    await expect(readFile(backupPath, "utf8")).resolves.toBe("{\"state\":true}");
    await expect(files.loadRecord()).resolves.toMatchObject({ status: "completed", backupPath });
    expect(path.dirname(backupPath)).toBe(directory);
  });

  it("serializes concurrent atomic saves and rejects corrupted records explicitly", async () => {
    const { store: files } = await store();
    await Promise.all([files.saveRecord(record("completed")), files.saveRecord(record("skipped"))]);
    await expect(files.loadRecord()).resolves.toMatchObject({ status: "skipped" });
    await writeFile(files.recordPath, "{\"status\":\"completed\"}", "utf8");
    await expect(files.loadRecord()).rejects.toEqual(expect.objectContaining<Partial<PlanApiMigrationStorageError>>({
      code: "record_invalid",
    }));
  });

  it("distinguishes a missing record from a missing legacy backup source", async () => {
    const { store: files } = await store();
    await expect(files.loadRecord()).resolves.toBeNull();
    await expect(files.backupLegacy()).rejects.toEqual(expect.objectContaining<Partial<PlanApiMigrationStorageError>>({
      code: "backup_failed",
    }));
  });
});
