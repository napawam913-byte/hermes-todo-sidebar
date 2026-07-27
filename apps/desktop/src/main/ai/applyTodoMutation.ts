/**
 * 模块用途：执行提案中的普通待办操作并返回新的待办数组。
 * 模块边界：假定目标和版本已统一校验，不访问持久化或周期计划。
 */
import type { Todo } from "../../shared/appDomainTypes.js";
import type { AppMutationSource } from "../../shared/appMutationTypes.js";
import type { AiMutationOperation } from "../../shared/aiMutationTypes.js";

type TodoMutationOperation = Extract<AiMutationOperation, {
  type: "todo.create" | "todo.update" | "todo.complete" | "todo.reopen" | "todo.delete";
}>;

interface ApplyContext {
  now: string;
  source: AppMutationSource;
  idFactory(prefix: string): string;
}

export function applyTodoMutation(
  todos: Todo[],
  operation: AiMutationOperation,
  context: ApplyContext
): Todo[] {
  if (!isTodoOperation(operation)) return todos;
  const syncStatus = context.source.type === "manual" ? "local" : "queued";
  if (operation.type === "todo.create") {
    const todo: Todo = {
      id: context.idFactory("todo"),
      title: operation.draft.title,
      date: operation.draft.date,
      notes: operation.draft.notes,
      status: "pending",
      syncStatus,
      source: context.source,
      createdAt: context.now,
      updatedAt: context.now,
      snoozeCount: 0
    };
    return [todo, ...todos];
  }
  if (operation.type === "todo.delete") {
    return todos.filter((todo) => todo.id !== operation.targetId);
  }
  return todos.map((todo) => {
    if (todo.id !== operation.targetId) return todo;
    if (operation.type === "todo.update") {
      return {
        ...todo,
        ...withoutUndefined(operation.patch),
        syncStatus,
        updatedAt: context.now
      };
    }
    if (operation.type === "todo.complete") {
      return {
        ...todo,
        status: "completed" as const,
        completedAt: context.now,
        syncStatus,
        updatedAt: context.now
      };
    }
    return {
      ...todo,
      status: "pending" as const,
      completedAt: undefined,
      syncStatus,
      updatedAt: context.now
    };
  });
}

function isTodoOperation(operation: AiMutationOperation): operation is TodoMutationOperation {
  return operation.type === "todo.create"
    || operation.type === "todo.update"
    || operation.type === "todo.complete"
    || operation.type === "todo.reopen"
    || operation.type === "todo.delete";
}

function withoutUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as Partial<T>;
}
