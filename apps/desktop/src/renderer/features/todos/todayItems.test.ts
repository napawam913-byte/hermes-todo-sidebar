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
    id: "todo_manual_pending",
    title: "手动补充一条待办",
    status: "pending",
    syncStatus: "local",
    createdAt: "2026-07-10T08:00:00.000Z",
    updatedAt: "2026-07-10T08:00:00.000Z",
    snoozeCount: 0
  },
  {
    id: "todo_manual_completed",
    title: "已经完成的手动待办",
    status: "completed",
    syncStatus: "synced",
    createdAt: "2026-07-09T08:00:00.000Z",
    updatedAt: "2026-07-10T09:00:00.000Z",
    completedAt: "2026-07-10T09:00:00.000Z",
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
      "上肢力量训练",
      "教程第 3 章学习",
      "手动补充一条待办",
      "已经完成的手动待办"
    ]);
    expect(items.map((item) => item.sourceLabel)).toEqual(["周期任务", "周期任务", "手动", "手动"]);
  });

  it("filters today items by pending, completed, and all", () => {
    const items = buildTodayItems({
      todos: manualTodos,
      cyclePlans: mockCyclePlans,
      dateKey: "2026-07-10"
    });

    expect(filterTodayItems(items, "pending")).toHaveLength(3);
    expect(filterTodayItems(items, "completed")).toHaveLength(1);
    expect(filterTodayItems(items, "all")).toHaveLength(4);
  });

  it("builds summary cards from the merged today view", () => {
    const items = buildTodayItems({
      todos: manualTodos,
      cyclePlans: mockCyclePlans,
      dateKey: "2026-07-10"
    });

    expect(getTodaySummary(items)).toEqual({
      pending: 3,
      completed: 1,
      all: 4
    });
  });
});
