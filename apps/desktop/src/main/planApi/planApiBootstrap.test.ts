/**
 * 模块用途：验证 Plan API IPC 数据端口始终返回带运行状态的快照信封。
 * 模块边界：只测试 bootstrap 适配器，不启动 Electron、SSH 或真实 HTTP。
 */
import { describe, expect, it, vi } from "vitest";
import type { AppMutationBatch } from "../../shared/appMutationTypes";
import type {
  PlanApiMigrationInspection,
  PlanApiSnapshotEnvelope
} from "../../shared/planApiBridgeContract";
import {
  createPlanApiMigrationPort,
  createPlanApiSnapshotPort
} from "./planApiBootstrap.js";

vi.mock("electron", () => ({
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (value: string) => Buffer.from(value),
    decryptString: (value: Buffer) => value.toString()
  }
}));

const batch: AppMutationBatch = {
  source: { type: "manual" },
  summary: "新增待办",
  operations: [{
    type: "todo.create",
    draft: { title: "联调任务", date: "2026-07-27" }
  }]
};

describe("createPlanApiSnapshotPort", () => {
  it("returns the runtime envelope for both load and mutation IPC paths", async () => {
    const envelope: PlanApiSnapshotEnvelope = {
      todos: [{ id: "todo_remote" }],
      cyclePlans: [],
      status: {
        mode: "online",
        canMutate: true,
        message: "数据服务已连接",
        cacheAvailable: true,
        serverRevision: 9
      }
    };
    const runtime = {
      getSnapshotEnvelope: vi.fn(async () => envelope),
      execute: vi.fn(async () => ({
        schemaVersion: 1,
        todos: envelope.todos,
        cyclePlans: envelope.cyclePlans,
        settings: { launchAtLogin: false },
        updatedAt: "2026-07-27T08:00:00.000Z"
      }))
    };
    const port = createPlanApiSnapshotPort(runtime);

    await expect(port.loadState()).resolves.toEqual(envelope);
    await expect(port.executeMutations(batch)).resolves.toEqual(envelope);
    expect(runtime.execute).toHaveBeenCalledWith(batch);
    expect(runtime.getSnapshotEnvelope).toHaveBeenCalledTimes(2);
  });
});

describe("createPlanApiMigrationPort", () => {
  it("returns the real inspection without migrating or refreshing runtime state", async () => {
    const inspection: PlanApiMigrationInspection = {
      status: "ready",
      taskCount: 2,
      entryCount: 5
    };
    const service = {
      inspect: vi.fn(async () => inspection),
      migrate: vi.fn(),
      keepRemoteAndSkip: vi.fn()
    };
    const refresh = vi.fn();
    const port = createPlanApiMigrationPort(async () => service, refresh);

    await expect(port.inspectMigration()).resolves.toEqual(inspection);
    expect(service.inspect).toHaveBeenCalledOnce();
    expect(service.migrate).not.toHaveBeenCalled();
    expect(service.keepRemoteAndSkip).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("refreshes runtime only after a migration-changing action", async () => {
    const completed: PlanApiMigrationInspection = {
      status: "blocked",
      reason: "legacy_empty"
    };
    const service = {
      inspect: vi.fn(),
      migrate: vi.fn(async () => completed),
      keepRemoteAndSkip: vi.fn(async () => completed)
    };
    const refresh = vi.fn(async () => undefined);
    const port = createPlanApiMigrationPort(async () => service, refresh);

    await expect(port.migrateLegacyState()).resolves.toEqual(completed);
    expect(refresh).toHaveBeenCalledOnce();
  });
});
