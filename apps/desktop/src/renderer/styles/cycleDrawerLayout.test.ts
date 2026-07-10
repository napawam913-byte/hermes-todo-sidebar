/**
 * 模块用途：锁定周期任务详情的固定双栏 CSS 尺寸契约。
 * 模块边界：只验证关键布局尺寸，不测试颜色、文案和业务数据。
 */
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readStyle(name: string) {
  return readFileSync(new URL(`./${name}`, import.meta.url), "utf8");
}

function getRule(css: string, selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  return match?.[1] ?? "";
}

describe("周期任务固定双栏布局", () => {
  it("保持 360px 主面板并在右侧打开 400px 详情", () => {
    const sidebar = readStyle("sidebar.css");
    const panel = readStyle("todo-panel.css");
    const styleNames = readdirSync(new URL("./", import.meta.url));

    expect(styleNames).toContain("detail-drawer.css");
    const drawer = readStyle("detail-drawer.css");

    expect(getRule(sidebar, ".sidebar-content")).toContain("width: 360px");
    expect(getRule(panel, ".todo-panel")).toContain("width: 360px");
    const expandedShell = getRule(drawer, ".sidebar-shell:has(.detail-drawer)");
    expect(expandedShell).toContain("width: 760px");
    expect(expandedShell).toContain("transition-property: height");
    expect(getRule(drawer, ".detail-drawer-divider")).toContain("width: 1px");
    expect(getRule(drawer, ".detail-drawer-divider")).toContain("z-index: 12");
    expect(getRule(drawer, ".detail-drawer")).toContain("left: 360px");
    expect(getRule(drawer, ".detail-drawer")).toContain("width: 400px");
  });

  it("周期任务通过通用组件渲染详情壳层", () => {
    const source = readFileSync(
      new URL("../features/cyclePlans/CyclePlanDrawer.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain("DetailDrawerShell");
  });

  it("今日与周期视图响应父级详情关闭状态", () => {
    const todaySource = readFileSync(
      new URL("../features/todos/TodayTodoView.tsx", import.meta.url),
      "utf8"
    );
    const cycleSource = readFileSync(
      new URL("../features/cyclePlans/CyclePlanView.tsx", import.meta.url),
      "utf8"
    );

    expect(todaySource).toContain("}, [props.detailResetVersion]);");
    expect(cycleSource).toContain("}, [detailResetVersion]);");
  });
});
