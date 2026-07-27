/**
 * 模块用途：锁定周期任务详情在响应式锚定面板内切页的布局契约。
 * 模块边界：只验证关键布局尺寸，不测试颜色、文案和业务数据。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readStyle(name: string) {
  return readFileSync(new URL(`./${name}`, import.meta.url), "utf8");
}

function getRule(css: string, selector: string) {
  const normalized = css.replace(/\r\n/g, "\n");
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = normalized.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  return match?.[1] ?? "";
}

describe("周期任务同面板详情布局", () => {
  it("使用主进程下发宽度并停止导入旧固定右侧抽屉", () => {
    const anchored = readStyle("anchored-popover.css");
    const cycle = readStyle("cycle-plan.css");
    const detailPage = readStyle("detail-page.css");
    const global = readStyle("global.css");
    const panel = readStyle("todo-panel.css");

    expect(getRule(anchored, ".sidebar-content")).toContain("width: var(--panel-width)");
    expect(getRule(anchored, ".sidebar-content")).not.toContain("360px");
    expect(getRule(anchored, ".sidebar-content")).toContain("height: var(--panel-height)");
    expect(getRule(anchored, ".sidebar-content")).toContain("overflow: clip");
    expect(getRule(anchored, ".sidebar-content > .todo-panel")).toContain("height: 100%");
    expect(getRule(panel, ".todo-panel")).toContain("width: 100%");
    expect(getRule(panel, ".todo-panel")).toContain("min-width: 0");
    expect(getRule(detailPage, ".detail-page")).toContain("flex: 1");
    expect(getRule(detailPage, ".detail-page")).toContain("width: 100%");
    expect(getRule(cycle, ".cycle-plan-view,\n.cycle-detail")).toContain("width: 100%");
    expect(global).toContain('@import "./detail-page.css"');
    expect(global).not.toContain('@import "./detail-drawer.css"');
  });

  it("周期任务通过通用组件渲染详情壳层", () => {
    const source = readFileSync(
      new URL("../features/cyclePlans/CyclePlanDrawer.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain("DetailPageShell");
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

    expect(todaySource).toContain("setActionItemKey(null)");
    expect(todaySource).toContain("[props.interactionResetVersion]");
    expect(todaySource).not.toContain("setSelectedItemKey(null);\n    setActionItemKey(null)");
    expect(cycleSource).not.toContain("setSelectedPlanId(null);\n  }, [");
  });
});
