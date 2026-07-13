/**
 * 模块用途：验证同面板详情页提供清晰的中文返回入口。
 * 模块边界：只检查静态结构，不管理待办或周期计划状态。
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DetailPageShell } from "./DetailPageShell";

describe("DetailPageShell", () => {
  it("在 360px 面板内渲染返回栏、标题和详情内容", () => {
    const html = renderToStaticMarkup(
      <DetailPageShell label="周期计划详情" title="健身计划" onBack={vi.fn()}>
        <p>训练动作</p>
      </DetailPageShell>
    );

    expect(html).toContain('aria-label="返回周期计划列表"');
    expect(html).toContain("健身计划");
    expect(html).toContain("训练动作");
    expect(html).not.toContain("详情抽屉");
  });
});
