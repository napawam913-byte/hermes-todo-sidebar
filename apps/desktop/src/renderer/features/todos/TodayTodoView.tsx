/**
 * 模块用途：今日待办视图，合并手动待办和当天命中的周期计划条目。
 * 模块边界：只处理今日页展示和用户完成动作，不编辑周期计划结构。
 */
import { useEffect, useMemo, useState } from "react";
import type { CyclePlan } from "../cyclePlans/cyclePlanTypes";
import { QuickAddBar } from "./QuickAddBar";
import { TodayTodoCard } from "./TodayTodoCard";
import { TodayTodoDetailDrawer } from "./TodayTodoDetailDrawer";
import { buildTodayItems, filterTodayItems, getTodaySummary, type TodayFilterKey } from "./todayItems";
import type { Todo } from "./types";

interface TodayTodoViewProps {
  todos: Todo[];
  cyclePlans: CyclePlan[];
  dateKey: string;
  detailResetVersion: number;
  onAdd: (title: string) => void;
  onCompleteTodo: (todo: Todo) => void;
  onCompleteCycleEntry: (entryId: string) => void;
}

const filterLabels: Record<TodayFilterKey, string> = {
  pending: "待处理",
  completed: "已完成",
  all: "全部"
};

export function TodayTodoView(props: TodayTodoViewProps) {
  const [filter, setFilter] = useState<TodayFilterKey>("pending");
  const [selectedItemKey, setSelectedItemKey] = useState<string | null>(null);
  const items = useMemo(
    () => buildTodayItems({ todos: props.todos, cyclePlans: props.cyclePlans, dateKey: props.dateKey }),
    [props.todos, props.cyclePlans, props.dateKey]
  );
  const summary = useMemo(() => getTodaySummary(items), [items]);
  const visibleItems = useMemo(() => filterTodayItems(items, filter), [items, filter]);
  const selectedItem = useMemo(
    () => items.find((item) => `${item.kind}-${item.id}` === selectedItemKey),
    [items, selectedItemKey]
  );
  useEffect(() => {
    setSelectedItemKey(null);
  }, [props.detailResetVersion]);

  if (selectedItem) {
    return <TodayTodoDetailDrawer item={selectedItem} onClose={() => setSelectedItemKey(null)} />;
  }

  return (
    <>
      <section className="todo-summary" aria-label="今日待办摘要">
        <SummaryCard label="待处理" value={summary.pending} />
        <SummaryCard label="已完成" value={summary.completed} />
        <SummaryCard label="全部" value={summary.all} />
      </section>

      <nav className="filter-tabs" aria-label="今日待办筛选">
        {(Object.keys(filterLabels) as TodayFilterKey[]).map((key) => (
          <button
            className={key === filter ? "filter-tab is-active" : "filter-tab"}
            key={key}
            type="button"
            onClick={() => setFilter(key)}
          >
            {filterLabels[key]}
          </button>
        ))}
      </nav>

      <QuickAddBar onAdd={props.onAdd} />

      <div className="todo-list" role="list">
        {visibleItems.length === 0 ? (
          <div className="empty-state">
            <strong>今天没有匹配的待办</strong>
            <span>手动添加，或在周期计划里安排今天的条目。</span>
          </div>
        ) : (
          visibleItems.map((item) => (
            <TodayTodoCard
              item={item}
              key={`${item.kind}-${item.id}`}
              selected={`${item.kind}-${item.id}` === selectedItemKey}
              onOpen={() => setSelectedItemKey(`${item.kind}-${item.id}`)}
              onComplete={() =>
                item.kind === "manual"
                  ? props.onCompleteTodo(item.todo)
                  : props.onCompleteCycleEntry(item.entry.id)
              }
            />
          ))
        )}
      </div>
    </>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
