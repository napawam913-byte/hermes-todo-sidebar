/**
 * 模块用途：验证今日待办卡片提供独立且可访问的详情入口。
 * 模块边界：只检查静态结构，不测试抽屉状态和 Electron 窗口。
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TodayTodoCard } from "./TodayTodoCard";
import type { TodayItem } from "./todayItems";

const manualItem: TodayItem = {
  kind: "manual",
  id: "todo-test",
  title: "测试待办",
  summary: "测试详情入口",
  status: "pending",
  sourceLabel: "手动",
  todo: {
    id: "todo-test",
    title: "测试待办",
    notes: "测试详情入口",
    status: "pending",
    syncStatus: "local",
    createdAt: "2026-07-10T08:00:00.000Z",
    updatedAt: "2026-07-10T08:00:00.000Z",
    snoozeCount: 0
  }
};

describe("TodayTodoCard", () => {
  it("为卡片主体提供查看详情入口", () => {
    const html = renderToStaticMarkup(
      <TodayTodoCard
        item={manualItem}
        selected={false}
        onComplete={() => undefined}
        onOpen={() => undefined}
      />
    );

    expect(html).toContain('aria-label="查看测试待办详情"');
  });
});
