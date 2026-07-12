/**
 * 模块用途：待办领域的纯函数，负责创建、完成、简单排序和后续提醒扩展。
 * 模块边界：不读写 UI 状态，不访问本地存储或网络。
 */
import type { ReminderKind, Todo, TodoEvent, TodoEventType, TodoMutationResult } from "./types";
import { toLocalDateKey } from "./useLocalDateKey";

interface CreateTodoDraftInput {
  title: string;
  remindAt?: Date;
  now: Date;
  sourceDeviceId: string;
}

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function createEvent(
  todo: Todo,
  type: TodoEventType,
  occurredAt: string,
  payload: Record<string, unknown>,
  sourceDeviceId = "desktop-local"
): TodoEvent {
  return {
    eventId: createId("evt"),
    todoId: todo.id,
    type,
    payload,
    occurredAt,
    sourceDeviceId,
    syncStatus: "queued",
    retryCount: 0
  };
}

export function createTodoDraft(input: CreateTodoDraftInput): TodoMutationResult {
  const title = input.title.trim();
  if (!title) {
    throw new Error("Todo title is required");
  }

  const timestamp = input.now.toISOString();
  const todo: Todo = {
    id: createId("todo"),
    title,
    date: toLocalDateKey(input.now),
    status: "pending",
    syncStatus: "queued",
    remindAt: input.remindAt?.toISOString(),
    createdAt: timestamp,
    updatedAt: timestamp,
    snoozeCount: 0
  };

  return {
    todo,
    event: createEvent(todo, "todo.created", timestamp, { todo }, input.sourceDeviceId)
  };
}

export function completeTodo(todo: Todo, now: Date): TodoMutationResult {
  const timestamp = now.toISOString();
  const completed: Todo = {
    ...todo,
    status: "completed",
    syncStatus: "queued",
    completedAt: timestamp,
    updatedAt: timestamp
  };

  return {
    todo: completed,
    event: createEvent(completed, "todo.completed", timestamp, { completedAt: timestamp })
  };
}

export function snoozeTodo(todo: Todo, minutes: number, now: Date): TodoMutationResult {
  const nextReminder = new Date(now.getTime() + minutes * 60_000).toISOString();
  const snoozed: Todo = {
    ...todo,
    syncStatus: "queued",
    remindAt: nextReminder,
    snoozeCount: todo.snoozeCount + 1,
    updatedAt: now.toISOString()
  };

  return {
    todo: snoozed,
    event: createEvent(snoozed, "todo.snoozed", now.toISOString(), {
      remindAt: nextReminder,
      minutes
    })
  };
}

export function getReminderKind(remindAt: string | undefined, now: Date): ReminderKind {
  if (!remindAt) return "none";

  const reminder = new Date(remindAt);
  if (reminder.getTime() < now.getTime()) return "overdue";

  const sameYear = reminder.getFullYear() === now.getFullYear();
  const sameMonth = reminder.getMonth() === now.getMonth();
  const sameDate = reminder.getDate() === now.getDate();

  return sameYear && sameMonth && sameDate ? "today" : "upcoming";
}

function getReminderPriority(todo: Todo, now: Date) {
  if (todo.status === "completed") return 5;

  const kind = getReminderKind(todo.remindAt, now);
  if (kind === "overdue") return 0;
  if (kind === "today") return 1;
  if (kind === "upcoming") return 2;
  return 3;
}

export function sortTodosForTodayFirst(todos: Todo[], now: Date): Todo[] {
  return [...todos].sort((left, right) => {
    const priorityDelta = getReminderPriority(left, now) - getReminderPriority(right, now);
    if (priorityDelta !== 0) return priorityDelta;

    const leftTime = left.remindAt ? new Date(left.remindAt).getTime() : Number.MAX_SAFE_INTEGER;
    const rightTime = right.remindAt ? new Date(right.remindAt).getTime() : Number.MAX_SAFE_INTEGER;
    if (leftTime !== rightTime) return leftTime - rightTime;

    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
}

export function sortTodosForSimpleList(todos: Todo[]): Todo[] {
  return [...todos].sort((left, right) => {
    if (left.status !== right.status) {
      return left.status === "pending" ? -1 : 1;
    }

    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
}
