import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  PlanApiMigrationFileStore,
  PlanApiMigrationStorageError,
} from "./planApiMigrationFileStore.js";

const directories: string[] = [];
const time = "2026-07-25T00:00:00.000Z";
const fingerprint = "a".repeat(64);
const state = {
  schemaVersion: 1 as const,
  todos: [],
  cyclePlans: [],
  settings: { launchAtLogin: true },
  updatedAt: time,
};
const record = (status: "pending" | "completed" | "skipped" = "completed") => ({
  schemaVersion: 1 as const,
  status,
  sourceUpdatedAt: time,
  sourceFingerprint: fingerprint,
  backupPath: "backup.json",
  idempotencyKey: `desktop-migration:${fingerprint}`,
  importedTaskCount: 2,
  importedEntryCount: 3,
  baselineRevision: 0,
  ...(status === "pending" ? {} : { completedAt: "2026-07-25T01:00:00.000Z" }),
});
async function setup() {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "plan-api-migration-"),
  );
  directories.push(directory);
  return {
    directory,
    store: new PlanApiMigrationFileStore(
      directory,
      () => new Date("2026-07-25T01:02:03.004Z"),
    ),
  };
}
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("PlanApiMigrationFileStore", () => {
  it("writes two unique immutable backups from frozen snapshots in the same millisecond", async () => {
    const { store } = await setup();
    const first = await store.backupLegacy(state);
    const second = await store.backupLegacy({
      ...state,
      updatedAt: "2026-07-25T00:01:00.000Z",
    });
    expect(first).not.toBe(second);
    expect(path.basename(first)).toMatch(
      /^state\.v1\.pre-plan-api-2026-07-25T01-02-03-004Z-[\w-]+\.json$/,
    );
    await expect(readFile(first, "utf8")).resolves.toContain(time);
    await expect(readFile(second, "utf8")).resolves.toContain("00:01:00");
  });
  it("serializes records and rejects malformed or incomplete pending logs explicitly", async () => {
    const { store } = await setup();
    await Promise.all([
      store.saveRecord(record("completed")),
      store.saveRecord(record("skipped")),
    ]);
    await expect(store.loadRecord()).resolves.toMatchObject({
      status: "skipped",
      sourceFingerprint: fingerprint,
    });
    await writeFile(
      store.recordPath,
      JSON.stringify({ ...record("pending"), completedAt: time }),
      "utf8",
    );
    await expect(store.loadRecord()).rejects.toEqual(
      expect.objectContaining<Partial<PlanApiMigrationStorageError>>({
        code: "record_invalid",
      }),
    );
  });
  it("treats only a missing record as empty and retains a safe cause for other IO errors", async () => {
    const { store } = await setup();
    await expect(store.loadRecord()).resolves.toBeNull();
    await writeFile(store.recordPath, "not json", "utf8");
    await expect(store.loadRecord()).rejects.toMatchObject({
      code: "record_invalid",
      cause: { name: "SyntaxError" },
    });
  });
});
