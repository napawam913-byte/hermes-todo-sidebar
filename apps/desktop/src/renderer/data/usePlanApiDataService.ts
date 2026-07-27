/**
 * 模块用途：把 Plan API preload 事件转换为 renderer 可消费的数据服务控制器。
 * 模块边界：只维护公开配置、运行状态和操作反馈，不保存 Token 或业务快照。
 */
import { useCallback, useEffect, useState } from "react";
import type {
  PlanApiConnectionInput,
  PlanApiConnectionTestResult,
  PlanApiMigrationInspection,
  PlanApiPublicConfig,
  PlanApiRuntimeStatus
} from "../../shared/planApiBridgeContract";
import type { PlanApiRendererBridge } from "./appDataBootstrap";

export interface PlanApiDataServiceController {
  status: PlanApiRuntimeStatus;
  config: PlanApiPublicConfig | null;
  migration: PlanApiMigrationInspection | null;
  busy: boolean;
  error: string | null;
  refreshConfig(): Promise<void>;
  refreshMigration(): Promise<void>;
  testConnection(input: PlanApiConnectionInput): Promise<PlanApiConnectionTestResult>;
  saveConnection(input: PlanApiConnectionInput): Promise<boolean>;
  migrateLegacyState(): Promise<boolean>;
  keepRemoteData(): Promise<boolean>;
}

interface UsePlanApiDataServiceOptions {
  bridge: PlanApiRendererBridge | null;
  initialStatus: PlanApiRuntimeStatus;
  onSnapshot(todos: unknown[], cyclePlans: unknown[]): void;
}

export function usePlanApiDataService(
  options: UsePlanApiDataServiceOptions
): PlanApiDataServiceController {
  const { bridge, initialStatus, onSnapshot } = options;
  const [status, setStatus] = useState(initialStatus);
  const [config, setConfig] = useState<PlanApiPublicConfig | null>(null);
  const [migration, setMigration] = useState<PlanApiMigrationInspection | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyLatestSnapshot = useCallback(async () => {
    if (!bridge) return;
    const snapshot = await bridge.loadState();
    setStatus(snapshot.status);
    onSnapshot(snapshot.todos, snapshot.cyclePlans);
  }, [bridge, onSnapshot]);

  const refreshConfig = useCallback(async () => {
    if (!bridge) {
      setConfig(null);
      setMigration(null);
      return;
    }
    try {
      const next = await bridge.getConfig();
      setConfig(next);
      if (!next.configured) {
        setMigration(null);
        return;
      }
      setMigration(await bridge.inspectMigration());
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }, [bridge]);

  const refreshMigration = useCallback(async () => {
    if (!bridge) {
      setMigration(null);
      return;
    }
    try {
      setMigration(await bridge.inspectMigration());
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }, [bridge]);

  const testConnection = useCallback(async (
    input: PlanApiConnectionInput
  ): Promise<PlanApiConnectionTestResult> => {
    if (!bridge) return { ok: false, message: "浏览器预览不提供数据服务连接" };
    setBusy(true);
    setError(null);
    try {
      const result = await bridge.testConnection(input);
      setError(result.ok ? null : result.message);
      return result;
    } catch (cause) {
      const message = errorMessage(cause);
      setError(message);
      return { ok: false, message };
    } finally {
      setBusy(false);
    }
  }, [bridge]);

  const run = useCallback(async (action: () => Promise<void>): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      await action();
      return true;
    } catch (cause) {
      setError(errorMessage(cause));
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const saveConnection = useCallback(async (
    input: PlanApiConnectionInput
  ): Promise<boolean> => run(async () => {
    if (!bridge) throw new Error("浏览器预览不提供数据服务连接");
    setConfig(await bridge.saveConnection(input));
    await applyLatestSnapshot();
    await refreshMigration();
  }), [applyLatestSnapshot, bridge, refreshMigration, run]);

  const migrateLegacyState = useCallback(async (): Promise<boolean> => run(async () => {
    if (!bridge) throw new Error("浏览器预览不提供数据迁移");
    await bridge.migrateLegacyState();
    await applyLatestSnapshot();
    await refreshMigration();
  }), [applyLatestSnapshot, bridge, refreshMigration, run]);

  const keepRemoteData = useCallback(async (): Promise<boolean> => run(async () => {
    if (!bridge) throw new Error("浏览器预览不提供数据迁移");
    await bridge.keepRemoteData();
    await applyLatestSnapshot();
    await refreshMigration();
  }), [applyLatestSnapshot, bridge, refreshMigration, run]);

  useEffect(() => {
    if (!bridge) return undefined;
    const releaseStatus = bridge.onStatusChanged(setStatus);
    const releaseSnapshot = bridge.onSnapshotChanged((snapshot) => {
      setStatus(snapshot.status);
      onSnapshot(snapshot.todos, snapshot.cyclePlans);
    });
    void refreshConfig();
    return () => {
      releaseSnapshot();
      releaseStatus();
    };
  }, [bridge, onSnapshot, refreshConfig, refreshMigration]);

  return {
    status,
    config,
    migration,
    busy,
    error,
    refreshConfig,
    refreshMigration,
    testConnection,
    saveConnection,
    migrateLegacyState,
    keepRemoteData
  };
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : "数据服务操作失败，请重试";
}
