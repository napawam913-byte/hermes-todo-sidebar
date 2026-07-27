import { describe, expect, it, vi } from "vitest";
import { PlanApiError } from "./planApiErrors.js";
import { PlanApiRuntime } from "./planApiRuntime.js";

const content = { schemaVersion: 1 as const, kind: "todo.general", title: "Task", summary: "Summary", locale: "zh-CN", sections: [] };
const apiSnapshot = (revision: number, id = "todo-1") => ({ serverRevision: revision, tasks: [{ id: "task-1", kind: "daily" as const, status: "active" as const, generation_mode: "fixed" as const, content, schedule_rule: null, generated_through_date: null, rule_revision: 0, version: revision, created_at: "2026-07-25T00:00:00.000Z", updated_at: "2026-07-25T00:00:00.000Z", entries: [{ id, task_id: "task-1", scheduled_date: "2026-07-25", status: "pending" as const, content, source: "manual" as const, slot_key: null, is_overridden: false, generation_revision: null, version: revision, created_at: "2026-07-25T00:00:00.000Z", updated_at: "2026-07-25T00:00:00.000Z", completed_at: null }] }] });
const cached = { schemaVersion: 1 as const, serverRevision: 3, syncedAt: "2026-07-25T00:00:00.000Z", todos: [{ id: "cached_todo", title: "Cached", date: "2026-07-25", status: "pending" as const, syncStatus: "synced" as const, source: { type: "manual" as const }, createdAt: "2026-07-25T00:00:00.000Z", updatedAt: "2026-07-25T00:00:00.000Z", snoozeCount: 0 }], cyclePlans: [] };
const connection = { mode: "local" as const, baseUrl: "http://127.0.0.1:8743", sshTarget: "", localPort: 8743, remotePort: 8743, token: "secret" };
const batch = (source = { type: "manual" as const }) => ({ source, summary: "create", operations: [{ type: "todo.create" as const, draft: { title: "Created", date: "2026-07-25" } }] });

function setup(options: { snapshots?: unknown[]; offline?: boolean; connection?: typeof connection; tunnel?: { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> } } = {}) {
  const events: string[] = []; const client = { snapshot: vi.fn(async () => { events.push("snapshot"); if (options.offline) throw new PlanApiError("offline"); return options.snapshots?.shift() ?? apiSnapshot(1); }), mutate: vi.fn(async () => { events.push("mutate"); }) };
  const cache = { load: vi.fn(async () => options.offline ? cached : null), save: vi.fn(async () => { events.push("cache.save"); }) };
  const legacy = { getSnapshot: vi.fn(() => ({ schemaVersion: 1 as const, todos: ["legacy"], cyclePlans: ["legacy"], settings: { launchAtLogin: false }, updatedAt: "2026-07-25T00:00:00.000Z" })), transact: vi.fn() };
  const store = { resolveConnection: vi.fn(async () => options.connection ?? connection), save: vi.fn(async () => ({ configured: true })) };
  return { events, client, cache, legacy, store, runtime: new PlanApiRuntime({ connectionStore: store, cache, legacyStateService: legacy, createClient: () => client, tunnel: options.tunnel }) };
}

describe("PlanApiRuntime", () => {
  it("shows cache offline and rejects mutations without touching legacy storage", async () => {
    const p = setup({ offline: true }); await p.runtime.initialize();
    await expect(p.runtime.getSnapshotEnvelope()).resolves.toMatchObject({ status: { mode: "offline_cache", canMutate: false }, todos: [{ id: "cached_todo" }] });
    await expect(p.runtime.execute(batch())).rejects.toMatchObject({ code: "offline" });
    expect(p.client.mutate).not.toHaveBeenCalled(); expect(p.legacy.transact).not.toHaveBeenCalled();
  });

  it("serializes online writes as mutate, snapshot, cache save and returns server state", async () => {
    const p = setup({ snapshots: [apiSnapshot(1), apiSnapshot(2, "todo-2")] }); await p.runtime.initialize(); p.events.length = 0;
    await expect(p.runtime.execute(batch())).resolves.toMatchObject({ todos: [{ id: "todo-2" }], settings: { launchAtLogin: false } });
    expect(p.events).toEqual(["mutate", "snapshot", "cache.save"]);
    expect(p.legacy.transact).not.toHaveBeenCalled();
  });

  it("uses proposal idempotency keys and refreshes, but never replays conflicts", async () => {
    const p = setup({ snapshots: [apiSnapshot(1), apiSnapshot(2)] }); await p.runtime.initialize();
    p.client.mutate.mockRejectedValueOnce(new PlanApiError("version_conflict"));
    await expect(p.runtime.execute(batch({ type: "ai_draft", proposalId: "proposal-7" }))).rejects.toMatchObject({ code: "version_conflict" });
    expect(p.client.mutate).toHaveBeenCalledOnce();
    expect(p.client.mutate.mock.calls[0][0].idempotencyKey).toBe("proposal-7");
    expect(p.client.snapshot).toHaveBeenCalledTimes(2);
  });

  it("merges only legacy settings into the AI stored snapshot", async () => {
    const p = setup(); await p.runtime.initialize();
    await expect(p.runtime.getStoredSnapshot()).resolves.toMatchObject({ todos: [{ id: "todo-1" }], cyclePlans: [], settings: { launchAtLogin: false } });
  });

  it("starts SSH forwarding and prevents late refreshes after shutdown", async () => {
    const tunnel = { start: vi.fn(() => undefined), stop: vi.fn(() => undefined) };
    const p = setup({ connection: { ...connection, mode: "ssh", sshTarget: "hermes-plan" }, tunnel });
    let release!: (value: ReturnType<typeof apiSnapshot>) => void;
    p.client.snapshot.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const initializing = p.runtime.initialize(); await Promise.resolve(); await p.runtime.shutdown(); release(apiSnapshot(1)); await initializing;
    expect(tunnel.start).toHaveBeenCalledWith(expect.objectContaining({ sshTarget: "hermes-plan" }));
    await expect(p.runtime.getSnapshotEnvelope()).resolves.toMatchObject({ status: { canMutate: false } });
  });
});
