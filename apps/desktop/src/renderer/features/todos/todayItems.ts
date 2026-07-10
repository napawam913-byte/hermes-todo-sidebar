/**
 * 模块用途：把手动待办和当天命中的周期计划条目合并为今日待办视图模型。
 * 模块边界：只做列表组装和筛选，不修改原始待办或周期计划。
 */
import { getCycleEntriesForDate } from "../cyclePlans/cyclePlanModel";
import type { CyclePlan, CyclePlanEntryWithPlan } from "../cyclePlans/cyclePlanTypes";
import { sortTodosForSimpleList } from "./todoModel";
import type { Todo, TodoStatus } from "./types";

export type TodayFilterKey = "pending" | "completed" | "all";
export type TodayItemKind = "manual" | "cycle";
export type TodaySourceLabel = "手动" | "周期任务";

export interface ManualTodayItem {
  kind: "manual";
  id: string;
  title: string;
  summary?: string;
  status: TodoStatus;
  sourceLabel: "手动";
  todo: Todo;
}

export interface CycleTodayItem {
  kind: "cycle";
  id: string;
  title: string;
  summary: string;
  status: TodoStatus;
  sourceLabel: "周期任务";
  planTitle: string;
  planTopic: string;
  entry: CyclePlanEntryWithPlan;
}

export type TodayItem = ManualTodayItem | CycleTodayItem;

interface BuildTodayItemsInput {
  todos: Todo[];
  cyclePlans: CyclePlan[];
  dateKey: string;
}

export function buildTodayItems(input: BuildTodayItemsInput): TodayItem[] {
  const cycleItems = getCycleEntriesForDate(input.cyclePlans, input.dateKey).map(toCycleTodayItem);
  const manualItems = sortTodosForSimpleList(input.todos).map(toManualTodayItem);

  return [...cycleItems, ...manualItems];
}

export function filterTodayItems(items: TodayItem[], filter: TodayFilterKey): TodayItem[] {
  if (filter === "all") return items;
  return items.filter((item) => item.status === filter);
}

export function getTodaySummary(items: TodayItem[]) {
  return {
    pending: items.filter((item) => item.status === "pending").length,
    completed: items.filter((item) => item.status === "completed").length,
    all: items.length
  };
}

function toManualTodayItem(todo: Todo): ManualTodayItem {
  return {
    kind: "manual",
    id: todo.id,
    title: todo.title,
    summary: todo.notes,
    status: todo.status,
    sourceLabel: "手动",
    todo
  };
}

function toCycleTodayItem(entry: CyclePlanEntryWithPlan): CycleTodayItem {
  return {
    kind: "cycle",
    id: entry.id,
    title: entry.title,
    summary: `${entry.planTitle} · ${entry.contentSummary}`,
    status: entry.status === "completed" ? "completed" : "pending",
    sourceLabel: "周期任务",
    planTitle: entry.planTitle,
    planTopic: entry.planTopic,
    entry
  };
}
