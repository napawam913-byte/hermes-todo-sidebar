/**
 * 模块用途：验证永久删除操作在预览中使用明确且不可误解的警示文案。
 * 模块边界：只渲染静态组件，不执行提案或访问 Electron。
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AiOperationCard } from "./AiOperationCard";

describe("AiOperationCard", () => {
  it("labels delete operations as permanent and irreversible", () => {
    const html = renderToStaticMarkup(<AiOperationCard operation={{
      type: "cyclePlan.entry.delete",
      targetId: "entry_1",
      expectedUpdatedAt: "2026-07-14T09:00:00.000Z"
    }} />);

    expect(html).toContain("永久删除");
    expect(html).toContain("不可恢复");
  });
});
