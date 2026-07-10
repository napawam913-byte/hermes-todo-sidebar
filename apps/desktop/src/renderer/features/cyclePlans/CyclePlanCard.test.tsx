/**
 * 模块用途：验证周期计划卡能正确回显统一来源对象。
 * 模块边界：只检查静态卡片文案，不管理计划状态或抽屉交互。
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CyclePlanCard } from "./CyclePlanCard";
import { mockCyclePlans } from "./mockCyclePlans";

describe("CyclePlanCard", () => {
  it("shows Feishu as a distinct plan source", () => {
    const plan = {
      ...mockCyclePlans[0],
      source: { type: "feishu" as const, externalId: "bitable_row_1" }
    };
    const html = renderToStaticMarkup(
      <CyclePlanCard plan={plan} todayKey="2026-07-10" onOpen={() => undefined} />
    );

    expect(html).toContain("飞书");
  });
});
