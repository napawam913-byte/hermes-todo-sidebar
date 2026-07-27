/**
 * 模块用途：验证数据状态横幅准确区分离线、迁移与浏览器预览。
 * 模块边界：只检查公开状态文案，不连接 Plan API。
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PlanApiRuntimeStatus } from "../../../shared/planApiBridgeContract";
import { DataServiceBanner } from "./DataServiceBanner";

const offline: PlanApiRuntimeStatus = {
  mode: "offline_cache",
  canMutate: false,
  message: "http://secret.example Bearer private-token",
  cacheAvailable: true
};

describe("DataServiceBanner", () => {
  it("marks cached Electron data as offline and read-only without leaking details", () => {
    const html = renderToStaticMarkup(
      <DataServiceBanner
        browserPreview={false}
        status={offline}
        onOpenDataSettings={() => undefined}
      />
    );

    expect(html).toContain('role="status"');
    expect(html).toContain("离线");
    expect(html).toContain("仅可查看");
    expect(html).not.toContain("secret.example");
    expect(html).not.toContain("private-token");
  });

  it("labels browser storage as a preview rather than a cloud connection", () => {
    const html = renderToStaticMarkup(
      <DataServiceBanner
        browserPreview
        status={{ ...offline, mode: "online", canMutate: true }}
        onOpenDataSettings={() => undefined}
      />
    );

    expect(html).toContain("浏览器预览");
    expect(html).toContain("数据保存在本机浏览器");
    expect(html).not.toContain("云端已连接");
  });

  it("links migration states to data service settings and hides ordinary online", () => {
    const migrationHtml = renderToStaticMarkup(
      <DataServiceBanner
        browserPreview={false}
        status={{ ...offline, mode: "migration_required" }}
        onOpenDataSettings={() => undefined}
      />
    );
    const onlineHtml = renderToStaticMarkup(
      <DataServiceBanner
        browserPreview={false}
        status={{ ...offline, mode: "online", canMutate: true }}
        onOpenDataSettings={() => undefined}
      />
    );

    expect(migrationHtml).toContain("进入数据服务设置");
    expect(onlineHtml).toBe("");
  });
});
