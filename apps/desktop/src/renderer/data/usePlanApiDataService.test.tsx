// @vitest-environment jsdom
/**
 * 模块用途：验证 renderer 数据服务控制器订阅、配置与迁移生命周期。
 * 模块边界：使用内存桥接，不调用 Electron IPC、网络或真实磁盘。
 */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type {
  PlanApiConnectionInput,
  PlanApiMigrationInspection,
  PlanApiPublicConfig,
  PlanApiRuntimeStatus,
  PlanApiSnapshotEnvelope
} from "../../shared/planApiBridgeContract";
import type { PlanApiRendererBridge } from "./appDataBootstrap";
import {
  usePlanApiDataService,
  type PlanApiDataServiceController
} from "./usePlanApiDataService";

const offline: PlanApiRuntimeStatus = {
  mode: "offline_cache",
  canMutate: false,
  message: "数据服务离线，当前仅可查看",
  cacheAvailable: true
};
const online: PlanApiRuntimeStatus = {
  mode: "online",
  canMutate: true,
  message: "数据服务已连接",
  cacheAvailable: true,
  serverRevision: 8
};
const config: PlanApiPublicConfig = {
  schemaVersion: 1,
  configured: true,
  mode: "local",
  baseUrl: "http://127.0.0.1:8743",
  sshTarget: "",
  localPort: 8743,
  remotePort: 8743,
  tokenConfigured: true,
  tokenHint: "…oken"
};
const connection: PlanApiConnectionInput = {
  mode: "local",
  baseUrl: "http://127.0.0.1:8743",
  sshTarget: "",
  localPort: 8743,
  remotePort: 8743,
  desktopToken: "secret"
};
const migrationReady: PlanApiMigrationInspection = {
  status: "ready",
  taskCount: 2,
  entryCount: 5
};
const migrationCompleted: PlanApiMigrationInspection = {
  status: "blocked",
  reason: "legacy_empty"
};

function bridge() {
  const statusListeners = new Set<(status: PlanApiRuntimeStatus) => void>();
  const snapshotListeners = new Set<(snapshot: PlanApiSnapshotEnvelope) => void>();
  const releaseStatus = vi.fn();
  const releaseSnapshot = vi.fn();
  let snapshot: PlanApiSnapshotEnvelope = { todos: [], cyclePlans: [], status: offline };
  const port = {
    loadState: vi.fn(async () => snapshot),
    executeMutations: vi.fn(),
    getConfig: vi.fn(async () => config),
    testConnection: vi.fn(async () => ({
      ok: true as const,
      message: "连接成功",
      apiVersion: 1 as const,
      serverRevision: 8
    })),
    saveConnection: vi.fn(async () => config),
    inspectMigration: vi.fn(async () => migrationReady),
    migrateLegacyState: vi.fn(async () => migrationCompleted),
    keepRemoteData: vi.fn(async () => migrationCompleted),
    onStatusChanged(listener: (status: PlanApiRuntimeStatus) => void) {
      statusListeners.add(listener);
      return () => { statusListeners.delete(listener); releaseStatus(); };
    },
    onSnapshotChanged(listener: (next: PlanApiSnapshotEnvelope) => void) {
      snapshotListeners.add(listener);
      return () => { snapshotListeners.delete(listener); releaseSnapshot(); };
    }
  } satisfies PlanApiRendererBridge;
  return {
    port,
    releaseSnapshot,
    releaseStatus,
    setSnapshot(next: PlanApiSnapshotEnvelope) {
      snapshot = next;
      snapshotListeners.forEach((listener) => listener(next));
    },
    setStatus(next: PlanApiRuntimeStatus) {
      statusListeners.forEach((listener) => listener(next));
    }
  };
}

async function mountController(
  port: PlanApiRendererBridge,
  onSnapshot = vi.fn()
) {
  let current: PlanApiDataServiceController | null = null;
  const container = document.createElement("div");
  const root = createRoot(container);
  function Probe() {
    current = usePlanApiDataService({ bridge: port, initialStatus: offline, onSnapshot });
    return null;
  }
  await act(async () => { root.render(<Probe />); });
  return {
    controller: () => {
      if (!current) throw new Error("controller 尚未挂载");
      return current;
    },
    onSnapshot,
    unmount: async () => { await act(async () => root.unmount()); }
  };
}

describe("usePlanApiDataService", () => {
  it("subscribes to status and snapshots, then releases both subscriptions", async () => {
    (globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean;
    }).IS_REACT_ACT_ENVIRONMENT = true;
    const fake = bridge();
    const mounted = await mountController(fake.port);
    expect(mounted.controller().config).toEqual(config);
    expect(mounted.controller().migration).toEqual(migrationReady);
    await act(async () => {
      fake.setStatus(online);
      fake.setSnapshot({
        todos: [{ id: "todo_remote" }],
        cyclePlans: [{ id: "plan_remote" }],
        status: online
      });
    });
    expect(mounted.controller().status).toEqual(online);
    expect(mounted.onSnapshot).toHaveBeenCalledWith(
      [{ id: "todo_remote" }],
      [{ id: "plan_remote" }]
    );
    await mounted.unmount();
    expect(fake.releaseStatus).toHaveBeenCalledOnce();
    expect(fake.releaseSnapshot).toHaveBeenCalledOnce();
  });

  it("tests without saving and refreshes public config/status after save", async () => {
    const fake = bridge();
    const mounted = await mountController(fake.port);

    await act(async () => {
      await mounted.controller().testConnection(connection);
    });
    expect(fake.port.testConnection).toHaveBeenCalledWith(connection);
    expect(fake.port.saveConnection).not.toHaveBeenCalled();
    expect(fake.port.inspectMigration).toHaveBeenCalledTimes(1);
    fake.port.loadState.mockResolvedValueOnce({ todos: [], cyclePlans: [], status: online });
    let saved = false;
    await act(async () => {
      saved = await mounted.controller().saveConnection(connection);
    });
    expect(saved).toBe(true);
    expect(mounted.controller().config).toEqual(config);
    expect(mounted.controller().status).toEqual(online);
    expect(fake.port.inspectMigration).toHaveBeenCalledTimes(2);
    expect(mounted.controller().busy).toBe(false);
    expect(mounted.controller().error).toBeNull();
    await mounted.unmount();
  });

  it("reports migration failures and recovers for keep-remote", async () => {
    const fake = bridge();
    const mounted = await mountController(fake.port);
    fake.port.migrateLegacyState.mockRejectedValueOnce(new Error("迁移失败"));
    let migrated = true;
    await act(async () => {
      migrated = await mounted.controller().migrateLegacyState();
    });
    expect(migrated).toBe(false);
    expect(mounted.controller().error).toBe("迁移失败");
    fake.port.loadState.mockResolvedValueOnce({ todos: [], cyclePlans: [], status: online });
    let kept = false;
    await act(async () => {
      kept = await mounted.controller().keepRemoteData();
    });
    expect(kept).toBe(true);
    expect(fake.port.keepRemoteData).toHaveBeenCalledOnce();
    expect(fake.port.inspectMigration).toHaveBeenCalledTimes(2);
    expect(mounted.controller().migration).toEqual(migrationReady);
    expect(mounted.controller().error).toBeNull();
    await mounted.unmount();
  });
  it("refreshes and exposes the real migration inspection on demand", async () => {
    const fake = bridge();
    const mounted = await mountController(fake.port);
    fake.port.inspectMigration.mockResolvedValueOnce(migrationCompleted);
    await act(async () => {
      await mounted.controller().refreshMigration();
    });
    expect(mounted.controller().migration).toEqual(migrationCompleted);
    expect(fake.port.migrateLegacyState).not.toHaveBeenCalled();
    expect(fake.port.keepRemoteData).not.toHaveBeenCalled();
    await mounted.unmount();
  });
});
