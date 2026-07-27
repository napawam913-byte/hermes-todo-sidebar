/**
 * 模块用途：验证周期计划详情提供计划状态、删除和条目状态操作。
 * 模块边界：只渲染静态 HTML，不提交实际变更。
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CyclePlanDrawer } from "./CyclePlanDrawer";
import { mockCyclePlans } from "./mockCyclePlans";

describe("周期计划详情操作", () => {
  it("renders plan and selected entry controls", () => {
    const html = renderToStaticMarkup(
      <CyclePlanDrawer
        busy={false}
        plan={mockCyclePlans[0]}
        todayKey="2026-07-10"
        onClose={() => undefined}
        onAiAdjust={() => undefined}
        onMutate={async () => true}
      />
    );
    expect(html).toContain("AI 调整");
    expect(html).not.toContain("编辑计划");
    expect(html).toContain("暂停计划");
    expect(html).toContain("归档计划");
    expect(html).toContain("删除计划");
    expect(html).toContain("完成条目");
    expect(html).toContain("跳过条目");
    expect(html).toContain("删除条目");
  });
});
