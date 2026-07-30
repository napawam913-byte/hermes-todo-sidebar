// @vitest-environment jsdom
/**
 * 模块用途：验证迁移阻塞时设置页主动补取检查结果，并优先展示迁移决策。
 * 模块边界：只测试数据服务设置视图，不访问 Electron、网络或真实用户数据。
 */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { PlanApiDataServiceController } from "../../data/usePlanApiDataService";
import { DataServiceSettings } from "./DataServiceSettings";

function controller(
  overrides: Partial<PlanApiDataServiceController> = {}
): PlanApiDataServiceController {
  return {
    status: {
      mode: "migration_blocked",
      canMutate: false,
      cacheAvailable: true,
      message: "数据迁移已阻塞"
    },
    config: {
      schemaVersion: 1,
      configured: true,
      mode: "ssh",
      baseUrl: "http://127.0.0.1:8743",
      sshTarget: "hermes-plan",
      localPort: 8743,
      remotePort: 8743,
      tokenConfigured: true,
      tokenHint: "test"
    },
    migration: null,
    busy: false,
    error: null,
    refreshConfig: vi.fn(),
    refreshMigration: vi.fn(async () => undefined),
    testConnection: vi.fn(),
    saveConnection: vi.fn(),
    migrateLegacyState: vi.fn(),
    keepRemoteData: vi.fn(),
    ...overrides
  };
}

describe("DataServiceSettings migration recovery", () => {
  it("refreshes a missing migration inspection when runtime is blocked", async () => {
    (globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean;
    }).IS_REACT_ACT_ENVIRONMENT = true;
    const dataService = controller();
    const root = createRoot(document.createElement("div"));

    await act(async () => {
      root.render(<DataServiceSettings dataService={dataService} />);
    });

    expect(dataService.refreshMigration).toHaveBeenCalledOnce();
    await act(async () => root.unmount());
  });

  it("places the keep-remote decision before the connection form", () => {
    const html = renderToStaticMarkup(
      <DataServiceSettings
        dataService={controller({
          migration: { status: "blocked", reason: "remote_not_empty" }
        })}
      />
    );

    expect(html.indexOf("保留云端数据")).toBeGreaterThanOrEqual(0);
    expect(html.indexOf("保留云端数据")).toBeLessThan(html.indexOf("连接模式"));
  });
});
