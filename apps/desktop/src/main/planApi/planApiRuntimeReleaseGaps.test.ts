import { describe, expect, it, vi } from "vitest";
import type { PlanApiMigrationInspection } from "../../shared/planApiBridgeContract.js";
import { PlanApiError } from "./planApiErrors.js";
import { PlanApiRuntime } from "./planApiRuntime.js";

const time = "2026-07-25T00:00:00.000Z";
const content = {
  schemaVersion: 1 as const,
  kind: "todo.general",
  title: "Task",
  summary: "Summary",
  locale: "zh-CN",
  sections: [],
};

function snapshot(revision = 1) {
  return {
    serverRevision: revision,
    tasks: [{
      id: "task-1",
      kind: "daily" as const,
      status: "active" as const,
      generation_mode: "fixed" as const,
      content,
      schedule_rule: null,
      generated_through_date: null,
      rule_revision: 0,
      version: revision,
      created_at: time,
      updated_at: time,
      entries: [{
        id: "entry-1",
        task_id: "task-1",
        scheduled_date: "2026-07-25",
        status: "pending" as const,
        content,
        source: "manual" as const,
        slot_key: null,
        is_overridden: false,
        generation_revision: null,
        version: revision,
        created_at: time,
        updated_at: time,
        completed_at: null,
      }],
    }],
  };
}

const batch = {
  source: { type: "manual" as const },
  summary: "create",
  operations: [{
    type: "todo.create" as const,
    draft: { title: "Created", date: "2026-07-25" },
  }],
};

const record = (status: "completed" | "skipped") => ({
  schemaVersion: 1 as const, status, sourceUpdatedAt: time, sourceFingerprint: "fingerprint",
  backupPath: "backup.json", idempotencyKey: "migration:key", importedTaskCount: 1,
  importedEntryCount: 1, baselineRevision: 1, completedAt: time,
});

function setup(options: {
  inspections?: PlanApiMigrationInspection[];
  inspectError?: Error;
  mutateError?: PlanApiError;
  snapshots?: ReturnType<typeof snapshot>[];
} = {}) {
  const inspections = [...(options.inspections ?? [{ status: "blocked", reason: "legacy_empty" }])];
  const snapshots = [...(options.snapshots ?? [snapshot(1)])];
  const client = {
    snapshot: vi.fn(async () => snapshots.shift() ?? snapshot(9)),
    mutate: vi.fn(async () => {
      if (options.mutateError) throw options.mutateError;
    }),
  };
  const cacheValue = {
    serverRevision: 1,
    syncedAt: time,
    todos: [{ id: "cached" }],
    cyclePlans: [],
  };
  const cache = {
    load: vi.fn(async () => cacheValue),
    save: vi.fn(async () => undefined),
  };
  const reconnect = { schedule: vi.fn(), cancel: vi.fn() };
  const migrationInspector = {
    inspect: vi.fn(async () => {
      if (options.inspectError) throw options.inspectError;
      return inspections.shift() ?? { status: "blocked", reason: "legacy_empty" };
    }),
  };
  const runtime = new PlanApiRuntime({
    connectionStore: {
      resolveConnection: vi.fn(async () => ({
        mode: "local" as const,
        baseUrl: "http://127.0.0.1:8743",
        sshTarget: "",
        localPort: 8743,
        remotePort: 8743,
        token: "secret",
      })),
      save: vi.fn(),
    },
    cache,
    legacyStateService: {
      getSnapshot: vi.fn(() => ({
        schemaVersion: 1 as const,
        todos: [],
        cyclePlans: [],
        settings: { launchAtLogin: false },
        updatedAt: time,
      })),
    },
    createClient: vi.fn(() => client),
    migrationInspector,
    reconnectPorts: reconnect,
    now: () => new Date(time),
  });
  return { runtime, client, cache, reconnect, migrationInspector };
}

describe("PlanApiRuntime release review gaps", () => {
  it.each([
    [{ status: "ready", taskCount: 2, entryCount: 3 }, "migration_required"],
    [{ status: "pending" }, "migration_required"],
    [{ status: "blocked", reason: "remote_not_empty" }, "migration_blocked"],
    [{ status: "blocked", reason: "legacy_changed" }, "migration_blocked"],
  ] as const)("fails closed for migration inspection %o", async (inspection, mode) => {
    const plan = setup({ inspections: [inspection] });

    await expect(plan.runtime.initialize()).resolves.toMatchObject({
      status: { mode, canMutate: false },
    });
    expect(plan.migrationInspector.inspect).toHaveBeenCalledOnce();
  });

  it.each([
    { status: "blocked", reason: "legacy_empty" },
    { status: "completed", record: record("completed") },
    { status: "skipped", record: record("skipped") },
  ] as PlanApiMigrationInspection[])("allows online writes after final migration state %o", async (inspection) => {
    const plan = setup({ inspections: [inspection] });
    await expect(plan.runtime.initialize()).resolves.toMatchObject({
      status: { mode: "online", canMutate: true },
    });
  });

  it("keeps writes closed when inspection fails and recovers after migration refresh", async () => {
    const failed = setup({ inspectError: new Error("inspection failed") });
    await expect(failed.runtime.initialize()).resolves.toMatchObject({
      status: { canMutate: false },
    });

    const recovered = setup({
      inspections: [
        { status: "ready", taskCount: 1, entryCount: 1 },
        { status: "completed", record: record("completed") },
      ],
      snapshots: [snapshot(1), snapshot(2)],
    });
    await recovered.runtime.initialize();
    await expect(recovered.runtime.refresh()).resolves.toMatchObject({
      status: { mode: "online", canMutate: true },
    });
  });

  it.each([
    new PlanApiError("offline"),
    new PlanApiError("http_error", 503),
  ])("downgrades mutation %s to cached read-only mode and schedules reconnect", async (error) => {
    const plan = setup({ mutateError: error });
    await plan.runtime.initialize();

    await expect(plan.runtime.execute(batch)).rejects.toBe(error);
    await expect(plan.runtime.getSnapshotEnvelope()).resolves.toMatchObject({
      todos: [{ id: "cached" }],
      status: { mode: "offline_cache", canMutate: false },
    });
    expect(plan.reconnect.schedule).toHaveBeenCalledOnce();
  });

  it.each([
    new PlanApiError("validation_failed"),
    new PlanApiError("http_error", 400),
  ])("does not reconnect for deterministic mutation %s", async (error) => {
    const plan = setup({ mutateError: error });
    await plan.runtime.initialize();

    await expect(plan.runtime.execute(batch)).rejects.toBe(error);
    expect(plan.reconnect.schedule).not.toHaveBeenCalled();
    await expect(plan.runtime.getSnapshotEnvelope()).resolves.toMatchObject({
      status: { mode: "online", canMutate: true },
    });
  });

  it("refreshes a version conflict without reconnecting when the latest snapshot succeeds", async () => {
    const plan = setup({
      mutateError: new PlanApiError("version_conflict"),
      snapshots: [snapshot(1), snapshot(2)],
    });
    await plan.runtime.initialize();

    await expect(plan.runtime.execute(batch)).rejects.toMatchObject({ code: "version_conflict" });
    expect(plan.client.snapshot).toHaveBeenCalledTimes(2);
    expect(plan.reconnect.schedule).not.toHaveBeenCalled();
  });
});
