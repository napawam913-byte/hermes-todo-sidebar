/**
 * 模块用途：验证周期计划编辑抽屉提供计划字段、多日期条目和 Markdown 输入。
 * 模块边界：只检查静态表单结构，不模拟浏览器提交事件。
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CyclePlanEditorDrawer } from "./CyclePlanEditorDrawer";

describe("CyclePlanEditorDrawer", () => {
  it("renders a reusable manual plan form", () => {
    const html = renderToStaticMarkup(
      <CyclePlanEditorDrawer
        busy={false}
        dateKey="2026-07-12"
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    expect(html).toContain("新建周期任务");
    expect(html).toContain('name="plan-title"');
    expect(html).toContain('type="date"');
    expect(html).toContain('name="entry-markdown-0"');
    expect(html).toContain("保存计划");
  });
});
