/**
 * 模块用途：验证响应式主从容器始终保留主列表，并按详情存在性标记布局状态。
 * 模块边界：仅检查稳定 DOM 合同，不模拟容器查询的视觉结果。
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ResponsiveMasterDetail } from "./ResponsiveMasterDetail";

describe("ResponsiveMasterDetail", () => {
  it("无详情时保留主内容并标记单栏状态", () => {
    const html = renderToStaticMarkup(
      <ResponsiveMasterDetail master={<div>主列表</div>} />
    );

    expect(html).toContain('data-testid="master-detail"');
    expect(html).toContain("is-master-only");
    expect(html).toContain("主列表");
    expect(html).not.toContain('data-testid="detail-pane"');
  });

  it("有详情时在同一 DOM 中同时渲染主内容和详情", () => {
    const html = renderToStaticMarkup(
      <ResponsiveMasterDetail
        master={<div>主列表</div>}
        detail={<div>详情内容</div>}
      />
    );

    expect(html).toContain("has-detail");
    expect(html).toContain('data-testid="master-pane"');
    expect(html).toContain('data-testid="detail-pane"');
    expect(html).toContain("主列表");
    expect(html).toContain("详情内容");
  });
});
