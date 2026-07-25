import type { Todo } from "../../shared/appDomainTypes.js";
import type { AppMutationOperation } from "../../shared/appMutationTypes.js";
import { todoToContentDocument } from "./contentDocumentMapper.js";
import { PlanApiError } from "./planApiErrors.js";
import type { MutationAdapterInput } from "./mutationAdapter.js";
import type {
  PlanApiMutationOperation,
  PlanApiTaskEntryDraft,
} from "./planApiWireTypes.js";

type TodoMutation = Extract<AppMutationOperation, { type: `todo.${string}` }>;

export function adaptTodoMutation(
  operation: TodoMutation,
  input: MutationAdapterInput,
): PlanApiMutationOperation[] {
  if (operation.type === "todo.create") {
    const content = todoContent(operation.draft);
    const entry: PlanApiTaskEntryDraft = {
      scheduled_date: operation.draft.date,
      status: "pending",
      content,
      source: entrySource(input),
      slot_key: null,
      is_overridden: false,
      generation_revision: null,
      completed_at: null,
    };
    return [{
      type: "task.create",
      draft: {
        kind: "daily",
        status: "active",
        generation_mode: "fixed",
        content,
        schedule_rule: null,
        generated_through_date: null,
        rule_revision: 1,
        entries: [entry],
      },
    }];
  }

  const todo = requireTodo(operation.targetId, input);
  const entry = input.versionIndex.requireEntry(todo.id);
  const task = input.versionIndex.requireTask(entry.taskId);
  if (operation.type === "todo.delete") {
    return [{ type: "task.delete", targetId: task.id, expectedVersion: task.version }];
  }
  if (operation.type === "todo.complete" || operation.type === "todo.reopen") {
    return [{
      type: operation.type === "todo.complete" ? "entry.complete" : "entry.reopen",
      targetId: entry.id,
      expectedVersion: entry.version,
    }];
  }

  const next = mergeTodo(todo, operation.patch);
  const changesContent = operation.patch.title !== undefined || operation.patch.notes !== undefined;
  const content = changesContent ? todoToContentDocument(next) : undefined;
  const operations: PlanApiMutationOperation[] = [];
  if (content) {
    operations.push({
      type: "task.update",
      targetId: task.id,
      expectedVersion: task.version,
      patch: { content },
    });
  }
  const patch: Record<string, unknown> = {};
  if (operation.patch.date !== undefined) patch.scheduled_date = operation.patch.date;
  if (content) patch.content = content;
  operations.push({
    type: "entry.update",
    targetId: entry.id,
    expectedVersion: entry.version,
    patch,
  });
  return operations;
}

function todoContent(draft: { title: string; date: string; notes?: string }) {
  return todoToContentDocument({
    id: "",
    title: draft.title,
    date: draft.date,
    notes: draft.notes,
    status: "pending",
    syncStatus: "local",
    source: { type: "manual" },
    createdAt: "",
    updatedAt: "",
    snoozeCount: 0,
  });
}

function mergeTodo(todo: Todo, patch: { title?: string; date?: string; notes?: string }): Todo {
  return {
    ...todo,
    ...(patch.title !== undefined ? { title: patch.title } : {}),
    ...(patch.date !== undefined ? { date: patch.date } : {}),
    ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
  };
}

function requireTodo(id: string, input: MutationAdapterInput): Todo {
  const todo = input.snapshot.todos.find((item) => item.id === id);
  if (!todo) throw new PlanApiError("validation_failed");
  return todo;
}

function entrySource(input: MutationAdapterInput): PlanApiTaskEntryDraft["source"] {
  return input.batch.source.type === "manual" ? "manual" : "hermes";
}
