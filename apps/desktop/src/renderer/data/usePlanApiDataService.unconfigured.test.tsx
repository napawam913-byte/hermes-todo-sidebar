// @vitest-environment jsdom
/**
 * 模块用途：验证未配置 Plan API 是正常初始状态，不显示迁移错误。
 * 模块边界：仅挂载数据服务 Hook，不访问 Electron 或网络。
 */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type {
  PlanApiPublicConfig,
  PlanApiRuntimeStatus,
} from "../../shared/planApiBridgeContract";
import type { PlanApiRendererBridge } from "./appDataBootstrap";
import {
  usePlanApiDataService,
  type PlanApiDataServiceController,
} from "./usePlanApiDataService";

const status: PlanApiRuntimeStatus = {
  mode: "unconfigured",
  canMutate: false,
  message: "尚未配置数据服务",
  cacheAvailable: false,
};
const config: PlanApiPublicConfig = {
  schemaVersion: 1,
  configured: false,
  mode: "local",
  baseUrl: "http://127.0.0.1:8743",
  sshTarget: "",
  localPort: 8743,
  remotePort: 8743,
  tokenConfigured: false,
  tokenHint: "",
};

describe("usePlanApiDataService unconfigured startup", () => {
  it("does not inspect migration or surface a red error before configuration", async () => {
    (globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean;
    }).IS_REACT_ACT_ENVIRONMENT = true;
    const inspectMigration = vi.fn(async () => {
      throw new Error("Plan API is not configured");
    });
    const onSnapshot = vi.fn();
    const bridge = {
      loadState: vi.fn(),
      executeMutations: vi.fn(),
      onSnapshotChanged: vi.fn(() => () => undefined),
      getConfig: vi.fn(async () => config),
      testConnection: vi.fn(),
      saveConnection: vi.fn(),
      inspectMigration,
      migrateLegacyState: vi.fn(),
      keepRemoteData: vi.fn(),
      onStatusChanged: vi.fn(() => () => undefined),
    } satisfies PlanApiRendererBridge;
    let controller: PlanApiDataServiceController | null = null;
    const root = createRoot(document.createElement("div"));
    const readController = () => {
      if (!controller) throw new Error("controller 尚未挂载");
      return controller;
    };

    function Probe() {
      controller = usePlanApiDataService({
        bridge,
        initialStatus: status,
        onSnapshot,
      });
      return null;
    }

    await act(async () => {
      root.render(<Probe />);
    });

    expect(inspectMigration).not.toHaveBeenCalled();
    expect(readController().migration).toBeNull();
    expect(readController().error).toBeNull();
    await act(async () => root.unmount());
  });
});
