/** 模块用途：验证 Plan API 的 Electron IPC 白名单与订阅释放。 */
import { describe, expect, it, vi } from "vitest";
import { registerPlanApiIpc } from "./planApiIpc.js";

type Handler = (...args: unknown[]) => unknown;
function fakeIpc(handlers: Map<string, Handler>) {
  return { handle: (channel: string, handler: Handler) => handlers.set(channel, handler), removeHandler: (channel: string) => handlers.delete(channel) };
}
function runtime() {
  const listener = vi.fn(); const unsubscribe = vi.fn();
  return {
    loadState: vi.fn(async () => ({ schemaVersion: 1, todos: [], cyclePlans: [], settings: { launchAtLogin: false }, updatedAt: "now" })),
    executeMutations: vi.fn(), getConfig: vi.fn(async () => ({ schemaVersion: 1, configured: true, mode: "local", baseUrl: "http://plan", sshTarget: "", localPort: 8743, remotePort: 8743, tokenConfigured: true, tokenHint: "1234" })),
    testConnection: vi.fn(), saveConnection: vi.fn(), migrateLegacyState: vi.fn(), keepRemoteData: vi.fn(),
    subscribe: vi.fn((callback: typeof listener) => { listener.mockImplementation(callback); return unsubscribe; }),
    listener, unsubscribe,
  };
}

describe("registerPlanApiIpc", () => {
  it("registers runtime data and connection handlers without legacy replace channels", () => {
    const handlers = new Map<string, Handler>();
    registerPlanApiIpc(fakeIpc(handlers), runtime());
    expect([...handlers.keys()]).toEqual(expect.arrayContaining([
      "plan-api:load-state", "plan-api:execute-mutations", "plan-api:get-config",
      "plan-api:test-connection", "plan-api:save-connection", "plan-api:migrate", "plan-api:keep-remote"
    ]));
    expect(handlers.has("data:replace-todos")).toBe(false);
    expect(handlers.has("data:replace-cycle-plans")).toBe(false);
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
});
