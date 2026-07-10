/**
 * 模块用途：定义待办和同步事件的前端领域类型。
 * 模块边界：只放共享类型，不放状态修改逻辑。
 */
export type TodoStatus = "pending" | "completed";
export type SyncStatus = "local" | "queued" | "synced" | "failed";

export type TodoEventType =
  | "todo.created"
  | "todo.updated"
  | "todo.completed"
  | "todo.snoozed"
  | "todo.deleted"
  | "reminder.fired";

export type ReminderKind = "none" | "overdue" | "today" | "upcoming";

export interface Todo {
  id: string;
  title: string;
  notes?: string;
  status: TodoStatus;
  syncStatus: SyncStatus;
  remindAt?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  snoozeCount: number;
}

export interface TodoEvent {
  eventId: string;
  todoId: string;
  type: TodoEventType;
  payload: Record<string, unknown>;
  occurredAt: string;
  sourceDeviceId: string;
  syncStatus: Extract<SyncStatus, "queued" | "synced" | "failed">;
  retryCount: number;
}

export interface TodoMutationResult {
  todo: Todo;
  event: TodoEvent;
}
