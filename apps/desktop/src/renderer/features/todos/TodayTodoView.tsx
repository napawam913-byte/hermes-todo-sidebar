/**
 * 模块用途：展示今日待办、筛选和详情入口。
 * 模块边界：只处理今日视图交互，不编辑周期计划结构。
 */
import { useEffect, useMemo, useState } from "react";
import { SegmentedControl } from "../../components/SegmentedControl";
import type { ManualMutationHandler } from "../../data/manualMutation";
import { buildEntryStatusOperation } from "../cyclePlans/cyclePlanMutationCommands";
import type { CyclePlan } from "../cyclePlans/cyclePlanTypes";
import { QuickAddBar } from "./QuickAddBar";
import { TodayTodoCard } from "./TodayTodoCard";
import { TodayTodoDetailDrawer } from "./TodayTodoDetailDrawer";
import { TodoActionMenu } from "./TodoActionMenu";
import { TodoEditorDrawer } from "./TodoEditorDrawer";
import {
  buildCompleteTodoOperation,
  buildCreateTodoOperation,
  buildDeleteTodoOperation,
  buildReopenTodoOperation,
  buildUpdateTodoOperation
} from "./todoMutationCommands";
import {
  buildTodayItems,
  filterTodayItems,
  getTodaySummary,
  type TodayFilterKey,
  type TodayItem
} from "./todayItems";
import type { Todo } from "./types";

interface TodayTodoViewProps {
  todos: Todo[];
  cyclePlans: CyclePlan[];
  dateKey: string;
  interactionResetVersion: number;
  busy: boolean;
  onMutate: ManualMutationHandler;
}

const filterLabels: Record<TodayFilterKey, string> = {
  pending: "待处理",
  completed: "已完成",
  all: "全部"
};

const filterOptions = (Object.keys(filterLabels) as TodayFilterKey[]).map((value) => ({
  value,
  label: filterLabels[value]
}));

export function TodayTodoView(props: TodayTodoViewProps) {
  const [filter, setFilter] = useState<TodayFilterKey>("pending");
  const [selectedItemKey, setSelectedItemKey] = useState<string | null>(null);
  const [actionItemKey, setActionItemKey] = useState<string | null>(null);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
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
  const actionItem = useMemo(
    () => items.find((item) => `${item.kind}-${item.id}` === actionItemKey),
    [actionItemKey, items]
  );

  useEffect(() => setActionItemKey(null), [props.interactionResetVersion]);

  if (editingTodo) {
    return (
      <TodoEditorDrawer
        busy={props.busy}
        interactionResetVersion={props.interactionResetVersion}
        todo={editingTodo}
        onClose={() => setEditingTodo(null)}
        onDelete={() => props.onMutate("永久删除待办", [buildDeleteTodoOperation(editingTodo)])}
        onSave={(draft) => props.onMutate("修改待办", [buildUpdateTodoOperation(editingTodo, draft)])}
      />
    );
  }

  if (actionItem) {
    return (
      <TodoActionMenu
        busy={props.busy}
        item={actionItem}
        onClose={() => setActionItemKey(null)}
        onComplete={() => mutateItemStatus(actionItem, "complete", props.onMutate)}
        onDelete={() => mutateItemStatus(actionItem, "delete", props.onMutate)}
        onEdit={() => {
          if (actionItem.kind !== "manual") return;
          setActionItemKey(null);
          setEditingTodo(actionItem.todo);
        }}
        onReopen={() => mutateItemStatus(actionItem, "reopen", props.onMutate)}
        onSkip={() => mutateItemStatus(actionItem, "skip", props.onMutate)}
      />
    );
  }

  if (selectedItem) {
    return (
      <TodayTodoDetailDrawer
        item={selectedItem}
        onClose={() => setSelectedItemKey(null)}
        onEdit={selectedItem.kind === "manual" ? () => setEditingTodo(selectedItem.todo) : undefined}
        onOpenActions={() => setActionItemKey(`${selectedItem.kind}-${selectedItem.id}`)}
      />
    );
  }

  return (
    <div className="today-todo-view">
      <section className="todo-summary" aria-label="今日待办摘要">
        <SummaryCard label="待处理" value={summary.pending} />
        <SummaryCard label="已完成" value={summary.completed} />
        <SummaryCard label="全部" value={summary.all} />
      </section>

      <nav className="filter-tabs">
        <SegmentedControl
          ariaLabel="今日待办筛选"
          options={filterOptions}
          size="compact"
          value={filter}
          onChange={setFilter}
        />
      </nav>

      <QuickAddBar
        busy={props.busy}
        onAdd={(title) => props.onMutate("新增今日待办", [buildCreateTodoOperation(title, props.dateKey)])}
      />

      <div className="todo-list" role="list">
        {visibleItems.length === 0 ? (
          <div className="empty-state">
            <strong>今天没有匹配的待办</strong>
            <span>手动添加，或在周期计划里安排今天的条目。</span>
          </div>
        ) : (
          visibleItems.map((item) => (
            <TodayTodoCard
              busy={props.busy}
              item={item}
              key={`${item.kind}-${item.id}`}
              selected={`${item.kind}-${item.id}` === selectedItemKey}
              onOpen={() => setSelectedItemKey(`${item.kind}-${item.id}`)}
              onMore={() => setActionItemKey(`${item.kind}-${item.id}`)}
              onComplete={() => void mutateItemStatus(item, "complete", props.onMutate)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function mutateItemStatus(
  item: TodayItem,
  action: "complete" | "reopen" | "skip" | "delete",
  mutate: ManualMutationHandler
): Promise<boolean> {
  const operation = item.kind === "manual"
    ? action === "complete"
      ? buildCompleteTodoOperation(item.todo)
      : action === "reopen"
        ? buildReopenTodoOperation(item.todo)
        : buildDeleteTodoOperation(item.todo)
    : buildEntryStatusOperation(item.entry, action);
  return mutate(`${actionLabel(action)}${item.title}`, [operation]);
}

function actionLabel(action: "complete" | "reopen" | "skip" | "delete") {
  return { complete: "完成", reopen: "恢复", skip: "跳过", delete: "永久删除" }[action];
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}
