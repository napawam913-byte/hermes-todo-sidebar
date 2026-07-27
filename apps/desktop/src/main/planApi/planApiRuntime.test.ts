import { describe, expect, it, vi } from "vitest";
import { PlanApiError } from "./planApiErrors.js";
import { PlanApiRuntime } from "./planApiRuntime.js";
const content = { schemaVersion: 1 as const, kind: "todo.general", title: "Task", summary: "Summary", locale: "zh-CN", sections: [] };
const time = "2026-07-25T00:00:00.000Z";
function snapshot(revision: number, id = "todo-1") {
  return {
    serverRevision: revision,
    tasks: [{
      id: "task-1", kind: "daily" as const, status: "active" as const, generation_mode: "fixed" as const,
      content, schedule_rule: null, generated_through_date: null, rule_revision: 0, version: revision,
      created_at: time, updated_at: time,
      entries: [{
        id, task_id: "task-1", scheduled_date: "2026-07-25", status: "pending" as const, content,
        source: "manual" as const, slot_key: null, is_overridden: false, generation_revision: null,
        version: revision, created_at: time, updated_at: time, completed_at: null,
      }],
    }],
  };
}
const conn = (baseUrl = "http://one:8743") => ({
  mode: "local" as const,
  baseUrl,
  sshTarget: "",
  localPort: 8743,
  remotePort: 8743,
  token: `${baseUrl}-token`,
});
function batch(reordered = false) {
  const draft = reordered
    ? { date: "2026-07-25", title: "Created" }
    : { title: "Created", date: "2026-07-25" };
  return {
    source: { type: "manual" as const },
    summary: reordered ? "different label" : "create",
    operations: [{ type: "todo.create" as const, draft }],
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  return { promise: new Promise<T>((done) => { resolve = done; }), resolve };
}
function setup(options: {
  connections?: (ReturnType<typeof conn> | null)[];
  clients?: Record<string, any>;
  cacheSave?: () => Promise<void>;
  reconnect?: any;
} = {}) {
  const cache = {
    load: vi.fn(async () => null),
    save: vi.fn(options.cacheSave ?? (async () => undefined)),
  };
  const store = {
    resolveConnection: vi.fn(async () => options.connections ? options.connections.shift() ?? null : conn()),
    save: vi.fn(async () => ({ configured: true })),
  };
  const legacy = {
    getSnapshot: vi.fn(() => ({
      schemaVersion: 1 as const,
      todos: ["old"],
      cyclePlans: ["old"],
      settings: { launchAtLogin: false },
      updatedAt: "old",
    })),
    transact: vi.fn(),
  };
  const createClient = vi.fn((baseUrl: string) => options.clients?.[baseUrl]);
  const runtime = new PlanApiRuntime({
    connectionStore: store,
    cache,
    legacyStateService: legacy,
    createClient, migrationInspector: { inspect: vi.fn(async () => ({ status: "blocked" as const, reason: "legacy_empty" as const })) },
    reconnectPorts: options.reconnect,
  });
  return { runtime, cache, store, legacy, createClient };
}
describe("PlanApiRuntime", () => {
  it("is cache-read-only offline and never calls legacy transact", async () => {
    const client = { snapshot: vi.fn(async () => { throw new PlanApiError("offline"); }), mutate: vi.fn() };
    const plan = setup({ clients: { "http://one:8743": client } });
    await plan.runtime.initialize();
    await expect(plan.runtime.execute(batch())).rejects.toMatchObject({ code: "offline" });
    expect(plan.legacy.transact).not.toHaveBeenCalled();
  });
  it("uses exact local and SSH client wiring and fails closed without a tunnel", async () => {
    const client = { snapshot: vi.fn(async () => snapshot(1)), mutate: vi.fn() };
    const local = setup({ clients: { "http://one:8743": client } });
    await local.runtime.initialize();
    expect(local.createClient).toHaveBeenCalledWith("http://one:8743", conn().token);
    const ssh = { ...conn(), mode: "ssh" as const, sshTarget: "hermes", localPort: 9999 };
    const plan = setup({ connections: [ssh], clients: { "http://127.0.0.1:9999": client } });
    await plan.runtime.initialize();
    expect(plan.createClient).not.toHaveBeenCalled();
    const tunnel = { start: vi.fn(() => undefined), stop: vi.fn(() => undefined) };
    const online = new PlanApiRuntime({
      connectionStore: { ...plan.store, resolveConnection: vi.fn(async () => ssh) },
      cache: plan.cache,
      legacyStateService: plan.legacy,
      createClient: plan.createClient,
      migrationInspector: { inspect: vi.fn(async () => ({ status: "blocked", reason: "legacy_empty" })) },
      tunnel,
    });
    await online.initialize();
    expect(tunnel.start).toHaveBeenCalledWith({ sshTarget: "hermes", localPort: 9999, remotePort: 8743 });
    expect(plan.createClient).toHaveBeenCalledWith("http://127.0.0.1:9999", ssh.token);
  });
  it("recovers the lifecycle queue after a failed save and caches the new connection", async () => {
    const old = deferred<any>();
    const one = { snapshot: vi.fn(() => old.promise), mutate: vi.fn() };
    const two = { snapshot: vi.fn(async () => snapshot(2, "new")), mutate: vi.fn() };
    const plan = setup({
      connections: [conn("http://one:8743"), conn("http://two:8743")],
      clients: { "http://one:8743": one, "http://two:8743": two },
    });
    plan.store.save.mockRejectedValueOnce(new Error("write failed")).mockResolvedValueOnce({ configured: true });
    const initial = plan.runtime.initialize();
    await Promise.resolve();
    const input = {
      mode: "local", baseUrl: "http://two:8743", sshTarget: "", localPort: 8743,
      remotePort: 8743, desktopToken: "x",
    };
    const failed = plan.runtime.saveConnection(input);
    old.resolve(snapshot(1, "old"));
    await initial;
    await expect(failed).rejects.toThrow("write failed");
    await plan.runtime.saveConnection(input);
    expect(plan.cache.save.mock.calls.at(-1)?.[0]).toMatchObject({ todos: [{ id: "new" }] });
    await expect(plan.runtime.getSnapshotEnvelope()).resolves.toMatchObject({ status: { mode: "online" } });
  });

  it("reuses a stable manual key until confirmation and then creates a new key", async () => {
    const client = {
      snapshot: vi.fn()
        .mockResolvedValueOnce(snapshot(1))
        .mockResolvedValueOnce(snapshot(2))
        .mockResolvedValueOnce(snapshot(3))
        .mockResolvedValueOnce(snapshot(4)),
      mutate: vi.fn().mockRejectedValueOnce(new PlanApiError("response_invalid")).mockResolvedValue(undefined),
    };
    const plan = setup({ clients: { "http://one:8743": client } });
    await plan.runtime.initialize();

    await expect(plan.runtime.execute(batch())).rejects.toMatchObject({ code: "response_invalid" });
    const first = client.mutate.mock.calls[0][0].idempotencyKey;
    await plan.runtime.refresh();
    await plan.runtime.execute(batch(true));
    expect(client.mutate.mock.calls[1][0].idempotencyKey).toBe(first);
    await plan.runtime.execute(batch());
    expect(client.mutate.mock.calls[2][0].idempotencyKey).not.toBe(first);
  });

  it("rejects repeated invalid manual batches before mutation", async () => {
    const client = { snapshot: vi.fn(async () => snapshot(1)), mutate: vi.fn() };
    const plan = setup({ clients: { "http://one:8743": client } });
    await plan.runtime.initialize();
    const invalid = { ...batch(), operations: [] } as any;

    await expect(plan.runtime.execute(invalid)).rejects.toMatchObject({ code: "validation_failed" });
    await expect(plan.runtime.execute(invalid)).rejects.toMatchObject({ code: "validation_failed" });
    expect(client.mutate).not.toHaveBeenCalled();
  });

  it("retries refresh after a version conflict but never replays the mutation", async () => {
    const reconnect = { schedule: vi.fn(), cancel: vi.fn() };
    const client = {
      snapshot: vi.fn().mockResolvedValueOnce(snapshot(1)).mockRejectedValueOnce(new PlanApiError("offline")),
      mutate: vi.fn(async () => { throw new PlanApiError("version_conflict"); }),
    };
    const plan = setup({ clients: { "http://one:8743": client }, reconnect });
    await plan.runtime.initialize();

    await expect(plan.runtime.execute(batch())).rejects.toMatchObject({ code: "version_conflict" });
    expect(client.mutate).toHaveBeenCalledOnce();
    expect(reconnect.schedule).toHaveBeenCalledOnce();
  });
  it("does not retry auth/cache failures, isolates listeners, and names unconfigured state", async () => {
    const reconnect = { schedule: vi.fn(), cancel: vi.fn() };
    const auth = { snapshot: vi.fn(async () => { throw new PlanApiError("auth_failed"); }), mutate: vi.fn() };
    const plan = setup({ clients: { "http://one:8743": auth }, reconnect });
    expect(() => plan.runtime.subscribe(() => { throw new Error("listener"); })).not.toThrow();
    await plan.runtime.initialize();
    expect(reconnect.schedule).not.toHaveBeenCalled();

    const disk = setup({
      clients: { "http://one:8743": { snapshot: vi.fn(async () => snapshot(1)), mutate: vi.fn() } },
      reconnect,
      cacheSave: async () => { throw new Error("disk"); },
    });
    await disk.runtime.initialize();
    expect(reconnect.schedule).not.toHaveBeenCalled();

    const unconfigured = setup({ connections: [null] });
    await unconfigured.runtime.initialize();
    await expect(unconfigured.runtime.getSnapshotEnvelope()).resolves.toMatchObject({
      status: { message: "数据服务尚未配置" },
    });
  });

  it("invalidates an in-flight mutation immediately on shutdown without cache pollution", async () => {
    const mutationStarted = deferred<void>();
    const pendingMutation = deferred<void>();
    const client = {
      snapshot: vi.fn(async () => snapshot(1)),
      mutate: vi.fn(() => { mutationStarted.resolve(); return pendingMutation.promise; }),
    };
    const plan = setup({ clients: { "http://one:8743": client } });
    await plan.runtime.initialize();

    const execution = plan.runtime.execute(batch());
    await mutationStarted.promise;
    const closing = plan.runtime.shutdown();
    pendingMutation.resolve();
    await expect(execution).rejects.toMatchObject({ code: "offline" });
    await closing;

    expect(plan.cache.save).toHaveBeenCalledTimes(1);
    expect(client.snapshot).toHaveBeenCalledOnce();
    await expect(plan.runtime.getSnapshotEnvelope()).resolves.toMatchObject({ status: { canMutate: false } });
  });
});
