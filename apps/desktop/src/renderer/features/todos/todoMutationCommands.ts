/**
 * 模块用途：把普通待办表单和按钮动作转换为通用变更操作。
 * 模块边界：只构造命令，不修改 React 状态或调用持久化网关。
 */
import type { AppMutationOperation } from "../../../shared/appMutationTypes";
import type { Todo } from "./types";

export interface TodoEditDraft {
  title: string;
  date: string;
  notes?: string;
}

export function buildCreateTodoOperation(
  title: string,
  date: string
): AppMutationOperation {
  return { type: "todo.create", draft: { title: title.trim(), date } };
}

export function buildUpdateTodoOperation(
  todo: Todo,
  draft: TodoEditDraft
): AppMutationOperation {
  return {
    type: "todo.update",
    targetId: todo.id,
    expectedUpdatedAt: todo.updatedAt,
    patch: {
      title: draft.title.trim(),
      date: draft.date,
      notes: draft.notes?.trim() ?? ""
    }
  };
}

export function buildCompleteTodoOperation(todo: Todo): AppMutationOperation {
  return targetOperation("todo.complete", todo);
}

export function buildReopenTodoOperation(todo: Todo): AppMutationOperation {
  return targetOperation("todo.reopen", todo);
}

export function buildDeleteTodoOperation(todo: Todo): AppMutationOperation {
  return targetOperation("todo.delete", todo);
}

function targetOperation(
  type: "todo.complete" | "todo.reopen" | "todo.delete",
  todo: Todo
): AppMutationOperation {
  return {
    type,
    targetId: todo.id,
    expectedUpdatedAt: todo.updatedAt,
    targetLabel: todo.title
  };
}
