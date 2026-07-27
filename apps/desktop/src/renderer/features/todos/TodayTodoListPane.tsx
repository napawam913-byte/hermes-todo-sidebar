/**
 * 模块用途：展示今日待办筛选、快速新增和待办列表。
 * 模块边界：只管理列表筛选，不管理详情、菜单或编辑状态。
 */
import { useMemo, useState } from "react";
import { SegmentedControl } from "../../components/SegmentedControl";
import { QuickAddBar } from "./QuickAddBar";
import { TodayTodoCard } from "./TodayTodoCard";
import {
  filterTodayItems,
  type TodayFilterKey,
  type TodayItem
} from "./todayItems";

interface TodayTodoListPaneProps {
  busy: boolean;
  items: TodayItem[];
  selectedItemKey: string | null;
  onAdd(title: string): Promise<boolean>;
  onComplete(item: TodayItem): void;
  onMore(item: TodayItem): void;
  onOpen(item: TodayItem): void;
}

const filterOptions: Array<{ value: TodayFilterKey; label: string }> = [
  { value: "pending", label: "待处理" },
  { value: "completed", label: "已完成" },
  { value: "all", label: "全部" }
];

export function TodayTodoListPane(props: TodayTodoListPaneProps) {
  const [filter, setFilter] = useState<TodayFilterKey>("pending");
  const visibleItems = useMemo(
    () => filterTodayItems(props.items, filter),
    [filter, props.items]
  );

  return (
    <div className="today-todo-view">
      <nav className="filter-tabs">
        <SegmentedControl
          ariaLabel="今日待办筛选"
          options={filterOptions}
          size="compact"
          value={filter}
          onChange={setFilter}
        />
      </nav>

      <QuickAddBar busy={props.busy} onAdd={props.onAdd} />

      <div className="todo-list" role="list">
        {visibleItems.length === 0 ? (
          <div className="empty-state">
            <strong>今天没有匹配的待办</strong>
            <span>手动添加，或在周期计划里安排今天的条目。</span>
          </div>
        ) : visibleItems.map((item) => {
          const itemKey = getItemKey(item);
          return (
            <TodayTodoCard
              busy={props.busy}
              item={item}
              key={itemKey}
              selected={itemKey === props.selectedItemKey}
              onComplete={() => props.onComplete(item)}
              onMore={() => props.onMore(item)}
              onOpen={() => props.onOpen(item)}
            />
          );
        })}
      </div>
    </div>
  );
}

export function getItemKey(item: TodayItem) {
  return `${item.kind}-${item.id}`;
}
