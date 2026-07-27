/**
 * 模块用途：为静态视图测试构造普通今日待办项。
 * 模块边界：仅供测试复用，不参与生产列表计算。
 */
import type { Todo } from "./types";
import type { ManualTodayItem } from "./todayItems";

export function toManualTodayItemForTest(todo: Todo): ManualTodayItem {
  return {
    kind: "manual",
    id: todo.id,
    title: todo.title,
    summary: todo.notes,
    status: todo.status,
    date: todo.date,
    isOverdue: false,
    sourceLabel: "手动",
    todo
  };
}
