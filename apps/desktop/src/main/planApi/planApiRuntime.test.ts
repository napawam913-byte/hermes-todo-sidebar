import { describe, expect, it, vi } from "vitest";
import { PlanApiError } from "./planApiErrors.js";
import { PlanApiRuntime } from "./planApiRuntime.js";

const content = { schemaVersion: 1 as const, kind: "todo.general", title: "Task", summary: "Summary", locale: "zh-CN", sections: [] };
const snapshot = (revision: number, id = "todo-1") => ({ serverRevision: revision, tasks: [{ id: "task-1", kind: "daily" as const, status: "active" as const, generation_mode: "fixed" as const, content, schedule_rule: null, generated_through_date: null, rule_revision: 0, version: revision, created_at: "2026-07-25T00:00:00.000Z", updated_at: "2026-07-25T00:00:00.000Z", entries: [{ id, task_id: "task-1", scheduled_date: "2026-07-25", status: "pending" as const, content, source: "manual" as const, slot_key: null, is_overridden: false, generation_revision: null, version: revision, created_at: "2026-07-25T00:00:00.000Z", updated_at: "2026-07-25T00:00:00.000Z", completed_at: null }] }] });
const conn = (baseUrl = "http://one:8743") => ({ mode: "local" as const, baseUrl, sshTarget: "", localPort: 8743, remotePort: 8743, token: `${baseUrl}-token` });
const batch = () => ({ source: { type: "manual" as const }, summary: "create", operations: [{ type: "todo.create" as const, draft: { title: "Created", date: "2026-07-25" } }] });
const deferred = <T>() => { let resolve!: (value: T) => void; return { promise: new Promise<T>(done => { resolve = done; }), resolve }; };

function setup(options: { connections?: ReturnType<typeof conn>[]; client?: Record<string, any>; cacheSave?: () => Promise<void>; reconnect?: any } = {}) {
  const clients = options.client ?? {}; const cache = { load: vi.fn(async () => null), save: vi.fn(options.cacheSave ?? (async () => undefined)) };
  const store = { resolveConnection: vi.fn(async () => options.connections?.shift() ?? conn()), save: vi.fn(async () => ({ configured: true })) };
  const legacy = { getSnapshot: vi.fn(() => ({ schemaVersion: 1 as const, todos: ["old"], cyclePlans: ["old"], settings: { launchAtLogin: false }, updatedAt: "old" })), transact: vi.fn() };
  const createClient = vi.fn((baseUrl: string) => clients[baseUrl]);
  const runtime = new PlanApiRuntime({ connectionStore: store, cache, legacyStateService: legacy, createClient, reconnectPorts: options.reconnect });
  return { runtime, cache, store, legacy, createClient };
}

describe("PlanApiRuntime", () => {
  it("is cache-read-only offline and never calls legacy transact", async () => {
    const client = { snapshot: vi.fn(async () => { throw new PlanApiError("offline"); }), mutate: vi.fn() };
    const p = setup({ client: { "http://one:8743": client } }); await p.runtime.initialize();
    await expect(p.runtime.execute(batch())).rejects.toMatchObject({ code: "offline" }); expect(p.legacy.transact).not.toHaveBeenCalled();
  });

  it("uses precise local and SSH clients, failing closed when SSH tunnel is absent", async () => {
    const client = { snapshot: vi.fn(async () => snapshot(1)), mutate: vi.fn() };
    const local = setup({ client: { "http://one:8743": client } }); await local.runtime.initialize(); expect(local.createClient).toHaveBeenCalledWith("http://one:8743", conn().token);
    const ssh = { ...conn(), mode: "ssh" as const, sshTarget: "hermes", localPort: 9999 };
    const p = setup({ connections: [ssh], client: { "http://127.0.0.1:9999": client } }); await p.runtime.initialize();
    expect(p.createClient).not.toHaveBeenCalled(); await expect(p.runtime.getSnapshotEnvelope()).resolves.toMatchObject({ status: { canMutate: false } });
    const tunnel = { start: vi.fn(() => undefined), stop: vi.fn(() => undefined) };
    const ok = new PlanApiRuntime({ connectionStore: { ...p.store, resolveConnection: vi.fn(async () => ssh) }, cache: p.cache, legacyStateService: p.legacy, createClient: p.createClient, tunnel });
    await ok.initialize(); expect(tunnel.start).toHaveBeenCalledWith({ sshTarget: "hermes", localPort: 9999, remotePort: 8743 }); expect(p.createClient).toHaveBeenCalledWith("http://127.0.0.1:9999", ssh.token);
  });

  it("serializes configuration, so an old refresh cannot overwrite the new cache", async () => {
    const old = deferred<any>(); const one = { snapshot: vi.fn(() => old.promise), mutate: vi.fn() }; const two = { snapshot: vi.fn(async () => snapshot(2, "new")), mutate: vi.fn() };
    const p = setup({ connections: [conn("http://one:8743"), conn("http://two:8743")], client: { "http://one:8743": one, "http://two:8743": two } });
    const start = p.runtime.initialize(); await Promise.resolve(); const change = p.runtime.saveConnection({ mode: "local", baseUrl: "http://two:8743", sshTarget: "", localPort: 8743, remotePort: 8743, desktopToken: "x" }); old.resolve(snapshot(1, "old")); await Promise.all([start, change]);
    expect(p.cache.save.mock.calls.at(-1)?.[0]).toMatchObject({ todos: [{ id: "new" }] });
  });

  it("reuses uncertain manual keys, clears only after confirmation, and is immediately inert on shutdown", async () => {
    const client = { snapshot: vi.fn().mockResolvedValueOnce(snapshot(1)).mockRejectedValueOnce(new PlanApiError("offline")).mockResolvedValueOnce(snapshot(2)).mockResolvedValueOnce(snapshot(3)).mockResolvedValueOnce(snapshot(4)), mutate: vi.fn(async () => undefined) };
    const p = setup({ client: { "http://one:8743": client } }); await p.runtime.initialize();
    await expect(p.runtime.execute(batch())).rejects.toMatchObject({ code: "offline" }); const first = client.mutate.mock.calls[0][0].idempotencyKey; await p.runtime.refresh();
    await p.runtime.execute(batch()); expect(client.mutate.mock.calls[1][0].idempotencyKey).toBe(first);
    await p.runtime.execute(batch()); expect(client.mutate.mock.calls[2][0].idempotencyKey).not.toBe(first);
    await p.runtime.shutdown(); await expect(p.runtime.execute(batch())).rejects.toMatchObject({ code: "offline" });
  });

  it("keeps auth and cache failures non-retrying, and isolates an initial throwing listener", async () => {
    const reconnect = { schedule: vi.fn(), cancel: vi.fn() }; const auth = { snapshot: vi.fn(async () => { throw new PlanApiError("auth_failed"); }), mutate: vi.fn() };
    const p = setup({ client: { "http://one:8743": auth }, reconnect }); expect(() => p.runtime.subscribe(() => { throw new Error("listener"); })).not.toThrow(); await p.runtime.initialize();
    expect(reconnect.schedule).not.toHaveBeenCalled(); await expect(p.runtime.getSnapshotEnvelope()).resolves.toMatchObject({ status: { message: expect.stringMatching(/认证|令牌/) } });
    const disk = setup({ client: { "http://one:8743": { snapshot: vi.fn(async () => snapshot(1)), mutate: vi.fn() } }, reconnect, cacheSave: async () => { throw new Error("disk"); } }); await disk.runtime.initialize(); expect(reconnect.schedule).not.toHaveBeenCalled();
  });

  it("does not cache or publish a snapshot that arrives after shutdown", async () => {
    const late = deferred<any>(); const client = { snapshot: vi.fn(() => late.promise), mutate: vi.fn() }; const p = setup({ client: { "http://one:8743": client } });
    const init = p.runtime.initialize(); await Promise.resolve(); await p.runtime.shutdown(); late.resolve(snapshot(1)); await init;
    expect(p.cache.save).not.toHaveBeenCalled(); await expect(p.runtime.getSnapshotEnvelope()).resolves.toMatchObject({ status: { canMutate: false } });
  });
});
