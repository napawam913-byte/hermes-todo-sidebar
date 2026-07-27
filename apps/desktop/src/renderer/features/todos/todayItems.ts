/**
 * 模块用途：把今日与逾期的手动待办、周期计划条目合并为今日视图模型。
 * 模块边界：只做列表组装、排序和筛选，不修改原始数据。
 */
import type { CyclePlan, CyclePlanEntryWithPlan } from "../cyclePlans/cyclePlanTypes";
import type { Todo, TodoStatus } from "./types";
import { toLocalDateKey } from "./useLocalDateKey";

export type TodayFilterKey = "pending" | "completed" | "all";
export type TodayItemKind = "manual" | "cycle";
export type TodaySourceLabel = "手动" | "周期任务" | "AI草稿" | "Hermes" | "飞书";
type ManualSourceLabel = Exclude<TodaySourceLabel, "周期任务">;

interface TodayItemBase {
  id: string;
  title: string;
  summary?: string;
  status: TodoStatus;
  date: string;
  isOverdue: boolean;
}

export interface ManualTodayItem extends TodayItemBase {
  kind: "manual";
  sourceLabel: ManualSourceLabel;
  todo: Todo;
}

export interface CycleTodayItem extends TodayItemBase {
  kind: "cycle";
  summary: string;
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
  const cycleItems = getVisibleCycleEntries(input.cyclePlans, input.dateKey)
    .map((entry) => toCycleTodayItem(entry, input.dateKey));
  const manualItems = input.todos
    .filter((todo) => isVisibleTodo(todo, input.dateKey))
    .map((todo) => toManualTodayItem(todo, input.dateKey));

  return [...cycleItems, ...manualItems].sort(compareTodayItems);
}

export function filterTodayItems(items: TodayItem[], filter: TodayFilterKey): TodayItem[] {
  if (filter === "all") return items;
  return items.filter((item) => item.status === filter);
}

function getVisibleCycleEntries(plans: CyclePlan[], dateKey: string): CyclePlanEntryWithPlan[] {
  return plans
    .filter((plan) => plan.status === "active")
    .flatMap((plan) => plan.entries
      .filter((entry) => isVisibleCycleEntry(entry, dateKey))
      .map((entry) => ({ ...entry, planTitle: plan.title, planTopic: plan.topic })));
}

function isVisibleTodo(todo: Todo, dateKey: string): boolean {
  if (todo.status === "pending") return todo.date <= dateKey;
  return todo.date === dateKey || isCompletedOn(todo.completedAt, dateKey);
}

function isVisibleCycleEntry(entry: CyclePlan["entries"][number], dateKey: string): boolean {
  if (entry.status === "candidate" || entry.status === "skipped") return false;
  if (entry.status === "pending") return entry.date <= dateKey;
  return entry.date === dateKey || isCompletedOn(entry.completedAt, dateKey);
}

function isCompletedOn(completedAt: string | undefined, dateKey: string): boolean {
  return Boolean(completedAt && toLocalDateKey(new Date(completedAt)) === dateKey);
}

function toManualTodayItem(todo: Todo, dateKey: string): ManualTodayItem {
  return {
    kind: "manual",
    id: todo.id,
    title: todo.title,
    summary: todo.notes,
    status: todo.status,
    date: todo.date,
    isOverdue: todo.status === "pending" && todo.date < dateKey,
    sourceLabel: toTodoSourceLabel(todo),
    todo
  };
}

function toTodoSourceLabel(todo: Todo): ManualSourceLabel {
  if (todo.source.type === "ai_draft") return "AI草稿";
  if (todo.source.type === "hermes") return "Hermes";
  if (todo.source.type === "feishu") return "飞书";
  return "手动";
}

function toCycleTodayItem(entry: CyclePlanEntryWithPlan, dateKey: string): CycleTodayItem {
  return {
    kind: "cycle",
    id: entry.id,
    title: entry.title,
    summary: `${entry.planTitle} · ${entry.contentSummary}`,
    status: entry.status === "completed" ? "completed" : "pending",
    date: entry.date,
    isOverdue: entry.status === "pending" && entry.date < dateKey,
    sourceLabel: "周期任务",
    planTitle: entry.planTitle,
    planTopic: entry.planTopic,
    entry
  };
}

function compareTodayItems(left: TodayItem, right: TodayItem): number {
  const bucketDelta = getSortBucket(left) - getSortBucket(right);
  if (bucketDelta !== 0) return bucketDelta;
  const dateDelta = left.date.localeCompare(right.date);
  if (dateDelta !== 0) return dateDelta;
  return 0;
}

function getSortBucket(item: TodayItem): number {
  if (item.status === "pending" && item.isOverdue) return 0;
  if (item.status === "pending" && item.kind === "cycle") return 1;
  if (item.status === "pending") return 2;
  return 3;
}
