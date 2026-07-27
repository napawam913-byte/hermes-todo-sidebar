/**
 * 模块用途：协调今日待办主列表、详情、操作菜单和编辑器。
 * 模块边界：保留现有 Mutation 命令，不承担列表筛选和具体视图渲染。
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ResponsiveMasterDetail } from "../../components/ResponsiveMasterDetail";
import type { ManualMutationHandler } from "../../data/manualMutation";
import { buildEntryStatusOperation } from "../cyclePlans/cyclePlanMutationCommands";
import type { CyclePlan } from "../cyclePlans/cyclePlanTypes";
import { TodayTodoDetailDrawer } from "./TodayTodoDetailDrawer";
import { TodayTodoListPane, getItemKey } from "./TodayTodoListPane";
import { TodoActionMenu } from "./TodoActionMenu";
import { TodoEditorDrawer } from "./TodoEditorDrawer";
import {
  buildCompleteTodoOperation,
  buildCreateTodoOperation,
  buildDeleteTodoOperation,
  buildReopenTodoOperation,
  buildUpdateTodoOperation
} from "./todoMutationCommands";
import { buildTodayItems, type TodayItem } from "./todayItems";
import type { Todo } from "./types";

interface TodayTodoViewProps {
  todos: Todo[];
  cyclePlans: CyclePlan[];
  dateKey: string;
  interactionResetVersion: number;
  busy: boolean;
  onMutate: ManualMutationHandler;
}

export function TodayTodoView(props: TodayTodoViewProps) {
  const [selectedItemKey, setSelectedItemKey] = useState<string | null>(null);
  const [actionItemKey, setActionItemKey] = useState<string | null>(null);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const items = useMemo(
    () => buildTodayItems({ todos: props.todos, cyclePlans: props.cyclePlans, dateKey: props.dateKey }),
    [props.cyclePlans, props.dateKey, props.todos]
  );
  const selectedItem = findItem(items, selectedItemKey);
  const actionItem = findItem(items, actionItemKey);

  useEffect(() => setActionItemKey(null), [props.interactionResetVersion]);

  const master = (
    <TodayTodoListPane
      busy={props.busy}
      items={items}
      selectedItemKey={selectedItemKey}
      onAdd={(title) => props.onMutate("新增今日待办", [buildCreateTodoOperation(title, props.dateKey)])}
      onComplete={(item) => void mutateItemStatus(item, "complete", props.onMutate)}
      onMore={(item) => setActionItemKey(getItemKey(item))}
      onOpen={(item) => setSelectedItemKey(getItemKey(item))}
    />
  );

  return <ResponsiveMasterDetail master={master} detail={renderDetail()} />;

  function renderDetail(): ReactNode {
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
          onEdit={() => openEditor(actionItem)}
          onReopen={() => mutateItemStatus(actionItem, "reopen", props.onMutate)}
          onSkip={() => mutateItemStatus(actionItem, "skip", props.onMutate)}
        />
      );
    }
    if (!selectedItem) return undefined;
    return (
      <TodayTodoDetailDrawer
        item={selectedItem}
        onClose={() => setSelectedItemKey(null)}
        onEdit={selectedItem.kind === "manual" ? () => setEditingTodo(selectedItem.todo) : undefined}
        onOpenActions={() => setActionItemKey(getItemKey(selectedItem))}
      />
    );
  }

  function openEditor(item: TodayItem) {
    if (item.kind !== "manual") return;
    setActionItemKey(null);
    setEditingTodo(item.todo);
  }
}

function findItem(items: TodayItem[], key: string | null) {
  return key ? items.find((item) => getItemKey(item) === key) : undefined;
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
  const label = { complete: "完成", reopen: "恢复", skip: "跳过", delete: "永久删除" }[action];
  return mutate(`${label}${item.title}`, [operation]);
}
