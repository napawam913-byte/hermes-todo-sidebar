/** 模块用途：验证 Plan API 的 Electron IPC 白名单与订阅释放。 */
import { describe, expect, it, vi } from "vitest";
import type {
  PlanApiMigrationInspection,
  PlanApiSnapshotEnvelope,
} from "../../shared/planApiBridgeContract.js";
import { registerPlanApiIpc } from "./planApiIpc.js";

type Handler = (...args: unknown[]) => unknown;
function fakeIpc(handlers: Map<string, Handler>) {
  return { handle: (channel: string, handler: Handler) => handlers.set(channel, handler), removeHandler: (channel: string) => handlers.delete(channel) };
}
function runtime() {
  const listener = vi.fn(); const unsubscribe = vi.fn();
  const envelope: PlanApiSnapshotEnvelope = {
    todos: [{ id: "todo_remote" }],
    cyclePlans: [],
    status: {
      mode: "online",
      canMutate: true,
      message: "数据服务已连接",
      cacheAvailable: true,
      serverRevision: 4,
    },
  };
  const inspection: PlanApiMigrationInspection = {
    status: "ready",
    taskCount: 1,
    entryCount: 2,
  };
  return {
    loadState: vi.fn(async () => envelope),
    executeMutations: vi.fn(async () => envelope),
    getConfig: vi.fn(async () => ({ schemaVersion: 1 as const, configured: true, mode: "local" as const, baseUrl: "http://plan", sshTarget: "", localPort: 8743, remotePort: 8743, tokenConfigured: true, tokenHint: "1234" })),
    testConnection: vi.fn(), saveConnection: vi.fn(),
    inspectMigration: vi.fn(async () => inspection),
    migrateLegacyState: vi.fn(), keepRemoteData: vi.fn(),
    subscribe: vi.fn((callback: typeof listener) => { listener.mockImplementation(callback); return unsubscribe; }),
    listener, unsubscribe, envelope, inspection,
  };
}
const connection = () => ({ mode: "local", baseUrl: "https://plan.example:8743", sshTarget: "", localPort: 8743, remotePort: 8743, desktopToken: "desktop-token" });

describe("registerPlanApiIpc", () => {
  it("registers runtime data and connection handlers without legacy replace channels", () => {
    const handlers = new Map<string, Handler>();
    registerPlanApiIpc(fakeIpc(handlers), runtime());
    expect([...handlers.keys()]).toEqual(expect.arrayContaining([
      "plan-api:load-state", "plan-api:execute-mutations", "plan-api:get-config",
      "plan-api:test-connection", "plan-api:save-connection",
      "plan-api:inspect-migration", "plan-api:migrate", "plan-api:keep-remote"
    ]));
    expect(handlers.has("data:replace-todos")).toBe(false);
    expect(handlers.has("data:replace-cycle-plans")).toBe(false);
  });

  it("returns snapshot envelopes and a read-only migration inspection", async () => {
    const handlers = new Map<string, Handler>();
    const plan = runtime();
    registerPlanApiIpc(fakeIpc(handlers), plan);

    await expect(handlers.get("plan-api:load-state")?.()).resolves.toEqual(plan.envelope);
    await expect(handlers.get("plan-api:inspect-migration")?.()).resolves.toEqual(
      plan.inspection,
    );
    expect(plan.inspectMigration).toHaveBeenCalledOnce();
    expect(plan.migrateLegacyState).not.toHaveBeenCalled();
    expect(plan.keepRemoteData).not.toHaveBeenCalled();
  });

  it("returns public configuration only and releases replaced subscriptions", async () => {
    const handlers = new Map<string, Handler>(); const ipc = fakeIpc(handlers); const plan = runtime();
    const release = registerPlanApiIpc(ipc, plan);
    await expect(handlers.get("plan-api:get-config")?.()).resolves.toEqual(expect.objectContaining({ tokenHint: "1234" }));
    expect(await handlers.get("plan-api:get-config")?.()).not.toHaveProperty("desktopToken");
    registerPlanApiIpc(ipc, plan);
    expect(plan.unsubscribe).toHaveBeenCalledOnce();
    release();
    expect(plan.unsubscribe).toHaveBeenCalledOnce();
    registerPlanApiIpc(ipc, plan)();
    expect(plan.unsubscribe).toHaveBeenCalledTimes(3);
  });

  it("rejects malformed connection payloads before testing or saving", () => {
    const handlers = new Map<string, Handler>(); const plan = runtime();
    registerPlanApiIpc(fakeIpc(handlers), plan);
    const test = handlers.get("plan-api:test-connection")!;
    const save = handlers.get("plan-api:save-connection")!;
    expect(() => test({}, { ...connection(), extra: true })).toThrow("字段");
    expect(() => save({}, { ...connection(), baseUrl: "file:///token" })).toThrow("地址");
    expect(() => test({}, { ...connection(), mode: "ssh", sshTarget: "", localPort: 0 })).toThrow();
    expect(() => save({}, { ...connection(), remotePort: 8743.5, desktopToken: 1 })).toThrow("端口");
    expect(() => test({}, connection())).not.toThrow();
    expect(plan.testConnection).toHaveBeenCalledWith(connection());
  });
});
