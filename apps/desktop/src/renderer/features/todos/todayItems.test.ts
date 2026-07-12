/**
 * 模块用途：验证今日待办视图如何合并手动待办和周期计划条目。
 * 模块边界：只覆盖列表组装、筛选和摘要，不访问 UI 或本地存储。
 */
import { describe, expect, it } from "vitest";
import { mockCyclePlans } from "../cyclePlans/mockCyclePlans";
import { buildTodayItems, filterTodayItems, getTodaySummary } from "./todayItems";
import type { Todo } from "./types";

const manualTodos: Todo[] = [
  {
    id: "todo_manual_overdue",
    title: "昨天未完成的手动待办",
    date: "2026-07-09",
    status: "pending",
    syncStatus: "local",
    createdAt: "2026-07-09T08:00:00.000Z",
    updatedAt: "2026-07-09T08:00:00.000Z",
    snoozeCount: 0
  },
  {
    id: "todo_manual_pending",
    title: "手动补充一条待办",
    date: "2026-07-10",
    status: "pending",
    syncStatus: "local",
    createdAt: "2026-07-10T08:00:00.000Z",
    updatedAt: "2026-07-10T08:00:00.000Z",
    snoozeCount: 0
  },
  {
    id: "todo_manual_completed",
    title: "已经完成的手动待办",
    date: "2026-07-10",
    status: "completed",
    syncStatus: "synced",
    createdAt: "2026-07-09T08:00:00.000Z",
    updatedAt: "2026-07-10T09:00:00.000Z",
    completedAt: "2026-07-10T09:00:00.000Z",
    snoozeCount: 0
  },
  {
    id: "todo_manual_future",
    title: "明天的手动待办",
    date: "2026-07-11",
    status: "pending",
    syncStatus: "local",
    createdAt: "2026-07-10T08:00:00.000Z",
    updatedAt: "2026-07-10T08:00:00.000Z",
    snoozeCount: 0
  }
];

describe("todayItems", () => {
  it("combines manual todos with cycle entries matching today", () => {
    const items = buildTodayItems({
      todos: manualTodos,
      cyclePlans: mockCyclePlans,
      dateKey: "2026-07-10"
    });

    expect(items.map((item) => item.title)).toEqual([
      "昨天未完成的手动待办",
      "上肢力量训练",
      "教程第 3 章学习",
      "手动补充一条待办",
      "已经完成的手动待办"
    ]);
    expect(items[0]).toMatchObject({ date: "2026-07-09", isOverdue: true });
    expect(items.some((item) => item.title === "明天的手动待办")).toBe(false);
  });

  it("filters today items by pending, completed, and all", () => {
    const items = buildTodayItems({
      todos: manualTodos,
      cyclePlans: mockCyclePlans,
      dateKey: "2026-07-10"
    });

    expect(filterTodayItems(items, "pending")).toHaveLength(4);
    expect(filterTodayItems(items, "completed")).toHaveLength(1);
    expect(filterTodayItems(items, "all")).toHaveLength(5);
  });

  it("builds summary cards from the merged today view", () => {
    const items = buildTodayItems({
      todos: manualTodos,
      cyclePlans: mockCyclePlans,
      dateKey: "2026-07-10"
    });

    expect(getTodaySummary(items)).toEqual({
      pending: 4,
      completed: 1,
      all: 5
    });
  });
});
