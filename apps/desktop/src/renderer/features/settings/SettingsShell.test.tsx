/**
 * 模块用途：验证设置控制台只暴露真实分区，并同时提供宽屏导航与紧凑 Tab 语义。
 * 模块边界：只检查静态结构，不执行设置保存或 Electron IPC。
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SettingsShell } from "./SettingsShell";

describe("SettingsShell", () => {
  it("renders the C console navigation with three real settings sections", () => {
    const html = renderToStaticMarkup(
      <SettingsShell
        activeSection="appearance"
        appearance={<div>外观内容</div>}
        model={<div>模型内容</div>}
        data={<div>数据服务内容</div>}
        dataStatus={{ label: "未配置", tone: "unconfigured" }}
        modelStatus={{ label: "已配置", tone: "configured" }}
        onSectionChange={() => undefined}
      />
    );

    expect(html).toContain('class="settings-sidebar"');
    expect(html).toContain('class="settings-compact-tabs"');
    expect(html).toContain("外观");
    expect(html).toContain("模型连接");
    expect(html).toContain("数据服务");
    expect(html).toContain("已配置");
    expect(html).not.toContain("数据管理");
    expect(html).not.toContain("开机启动");
    expect(html).toContain('aria-current="page"');
  });

  it("keeps both settings panes mounted and marks the inactive pane hidden", () => {
    const html = renderToStaticMarkup(
      <SettingsShell
        activeSection="model"
        appearance={<div>外观内容</div>}
        model={<div>模型内容</div>}
        data={<div>数据服务内容</div>}
        dataStatus={{ label: "连接正常", tone: "success" }}
        modelStatus={{ label: "连接正常", tone: "success" }}
        onSectionChange={() => undefined}
      />
    );

    expect(html).toContain("外观内容");
    expect(html).toContain("模型内容");
    expect(html).toContain("数据服务内容");
    expect(html).toMatch(/settings-pane[^>]*hidden=""[^>]*>.*外观内容/s);
  });

  it("marks the data tab current and exposes its status without connection details", () => {
    const html = renderToStaticMarkup(
      <SettingsShell
        activeSection="data"
        appearance={<div>外观内容</div>}
        data={<div>数据服务内容</div>}
        dataStatus={{ label: "迁移受阻", tone: "failure" }}
        model={<div>模型内容</div>}
        modelStatus={{ label: "已保存", tone: "configured" }}
        onSectionChange={() => undefined}
      />
    );

    expect(html).toMatch(/aria-current="page"[^>]*>数据服务/);
    expect(html).toContain('aria-label="数据服务，迁移受阻"');
    expect(html).not.toContain('<i aria-label=');
    expect(html).toContain("数据服务内容");
    expect(html).not.toContain("127.0.0.1");
  });
});
