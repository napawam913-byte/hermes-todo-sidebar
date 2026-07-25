import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PlanApiSnapshotCache, type PlanApiSnapshotCacheValue } from "./planApiSnapshotCache.js";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function makeDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "plan-api-cache-"));
  directories.push(directory);
  return directory;
}

function emptySnapshot(): PlanApiSnapshotCacheValue {
  return {
    schemaVersion: 1,
    serverRevision: 7,
    syncedAt: "2026-07-25T08:00:00.000Z",
    todos: [],
    cyclePlans: [],
  };
}

function validCyclePlan() {
  return {
    schemaVersion: 2 as const,
    id: "plan-1",
    title: "Plan",
    topic: "Topic",
    description: "Description",
    status: "active" as const,
    source: { type: "hermes" as const },
    entries: [],
    createdAt: "2026-07-25T08:00:00.000Z",
    updatedAt: "2026-07-25T08:00:00.000Z",
  };
}

describe("PlanApiSnapshotCache", () => {
  it("returns null for a damaged cache and never persists credentials", async () => {
    const directory = await makeDirectory();
    await writeFile(path.join(directory, "plan-api-cache.v1.json"), "{broken", "utf8");
    const cache = new PlanApiSnapshotCache(directory);

    await expect(cache.load()).resolves.toBeNull();
    await cache.save({ ...emptySnapshot(), token: "secret", Authorization: "Bearer secret" } as PlanApiSnapshotCacheValue);

    const raw = await readFile(path.join(directory, "plan-api-cache.v1.json"), "utf8");
    expect(raw).not.toContain("token");
    expect(raw).not.toContain("Authorization");
  });

  it.each([
    ["missing", undefined],
    ["top-level object", { ...emptySnapshot(), todos: {} }],
    ["cycle plan array", { ...emptySnapshot(), cyclePlans: {} }],
    ["malformed todo", { ...emptySnapshot(), todos: [{}] }],
    ["malformed cycle plan", { ...emptySnapshot(), cyclePlans: [{}] }],
  ])("returns null for %s cache data", async (_label, value) => {
    const directory = await makeDirectory();
    const filePath = path.join(directory, "plan-api-cache.v1.json");
    if (value !== undefined) await writeFile(filePath, JSON.stringify(value), "utf8");

    await expect(new PlanApiSnapshotCache(directory).load()).resolves.toBeNull();
  });

  it("round-trips a valid snapshot", async () => {
    const directory = await makeDirectory();
    const snapshot = emptySnapshot();
    const cache = new PlanApiSnapshotCache(path.join(directory, "nested"));

    await cache.save(snapshot);

    await expect(cache.load()).resolves.toEqual(snapshot);
  });

  it("round-trips arbitrary content data including credential-like business keys", async () => {
    const directory = await makeDirectory();
    const snapshot = {
      ...emptySnapshot(),
      cyclePlans: [{
        ...validCyclePlan(),
        entries: [{
          schemaVersion: 2 as const,
          id: "entry-1",
          planId: "plan-1",
          date: "2026-07-25",
          title: "Entry",
          contentSummary: "Summary",
          contentBlocks: [{ schemaVersion: 2 as const, id: "block-1", kind: "json", title: "Data", format: "json" as const, data: { token: "chapter-1", password: "wordplay" } }],
          status: "pending" as const,
          source: { type: "hermes" as const },
          createdAt: "2026-07-25T08:00:00.000Z",
          updatedAt: "2026-07-25T08:00:00.000Z",
        }],
      }],
    };

    const cache = new PlanApiSnapshotCache(directory);
    await cache.save(snapshot);

    await expect(cache.load()).resolves.toEqual(snapshot);
  });

  it("replaces an existing cache successfully", async () => {
    const directory = await makeDirectory();
    const cache = new PlanApiSnapshotCache(directory);
    await cache.save(emptySnapshot());
    const replacement = { ...emptySnapshot(), serverRevision: 8 };

    await cache.save(replacement);

    await expect(cache.load()).resolves.toEqual(replacement);
  });

  it("allows concurrent saves without sharing temporary files", async () => {
    const directory = await makeDirectory();
    const cache = new PlanApiSnapshotCache(directory);

    await expect(Promise.all(Array.from({ length: 8 }, (_, index) => cache.save({ ...emptySnapshot(), serverRevision: index })))).resolves.toHaveLength(8);
    await expect(readdir(directory)).resolves.not.toEqual(expect.arrayContaining(["plan-api-cache.v1.tmp"]));
    await expect(cache.load()).resolves.toMatchObject({ schemaVersion: 1 });
  });

  it("removes the temporary file when replacing the cache fails", async () => {
    const directory = await makeDirectory();
    const filePath = path.join(directory, "plan-api-cache.v1.json");
    await writeFile(filePath, "existing", "utf8");
    await rm(filePath);
    await import("node:fs/promises").then(({ mkdir }) => mkdir(filePath));

    await expect(new PlanApiSnapshotCache(directory).save(emptySnapshot())).rejects.toThrow();
    await expect(readdir(directory)).resolves.not.toEqual(expect.arrayContaining([expect.stringMatching(/^plan-api-cache\.v1\..+\.tmp$/)]));
  });
});
