/**
 * 模块用途：单条待办展示和操作，第一版只提供完成和更多入口。
 * 模块边界：只触发传入回调，不直接改写全局列表。
 */
import { Check, MoreHorizontal } from "lucide-react";
import { IconButton } from "../../components/buttons";
import { SyncStatusPill } from "../sync/SyncStatusPill";
import type { Todo } from "./types";

interface TodoItemProps {
  todo: Todo;
  onComplete: () => void;
}

export function TodoItem({ todo, onComplete }: TodoItemProps) {
  return (
    <article className={todo.status === "completed" ? "todo-item is-completed" : "todo-item"} role="listitem">
      <div className="todo-item-status" />
      <div className="todo-item-main">
        <div className="todo-item-title-row">
          <h2>{todo.title}</h2>
          <SyncStatusPill status={todo.syncStatus} />
        </div>
        {todo.notes ? <p>{todo.notes}</p> : null}
      </div>
      <div className="todo-item-actions">
        <IconButton icon={<Check size={16} strokeWidth={2} />} disabled={todo.status === "completed"} onClick={onComplete}>
          完成待办
        </IconButton>
        <IconButton icon={<MoreHorizontal size={16} strokeWidth={1.8} />}>更多操作</IconButton>
      </div>
    </article>
  );
}
