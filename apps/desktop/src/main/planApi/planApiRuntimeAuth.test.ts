/**
 * 模块用途：验证 Plan API 写入授权失效后的只读降级。
 * 模块边界：只覆盖认证失败，不重复网络重连与迁移状态场景。
 */
import { describe, expect, it, vi } from "vitest";
import { PlanApiError } from "./planApiErrors.js";
import { PlanApiRuntime } from "./planApiRuntime.js";

const time = "2026-07-25T00:00:00.000Z";
const batch = {
  source: { type: "manual" as const },
  summary: "create",
  operations: [{
    type: "todo.create" as const,
    draft: { title: "Created", date: "2026-07-25" },
  }],
};

describe("PlanApiRuntime mutation authentication", () => {
  it("fails closed without reconnecting when write authorization is revoked", async () => {
    const error = new PlanApiError("auth_failed", 401);
    const reconnect = { schedule: vi.fn(), cancel: vi.fn() };
    const client = {
      snapshot: vi.fn(async () => ({ serverRevision: 1, tasks: [] })),
      mutate: vi.fn(async () => {
        throw error;
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
          token: "revoked",
        })),
        save: vi.fn(),
      },
      cache: {
        load: vi.fn(async () => ({
          serverRevision: 1,
          syncedAt: time,
          todos: [{ id: "cached" }],
          cyclePlans: [],
        })),
        save: vi.fn(async () => undefined),
      },
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
      migrationInspector: {
        inspect: vi.fn(async () => ({
          status: "blocked" as const,
          reason: "legacy_empty" as const,
        })),
      },
      reconnectPorts: reconnect,
      now: () => new Date(time),
    });
    await runtime.initialize();

    await expect(runtime.execute(batch)).rejects.toBe(error);
    await expect(runtime.getSnapshotEnvelope()).resolves.toMatchObject({
      todos: [{ id: "cached" }],
      status: {
        mode: "offline_cache",
        canMutate: false,
        message: "数据服务认证失败，请检查连接令牌",
      },
    });
    expect(reconnect.schedule).not.toHaveBeenCalled();
  });
});
