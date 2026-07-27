/**
 * 模块用途：定义待办和同步事件的前端领域类型。
 * 模块边界：只放共享类型，不放状态修改逻辑。
 */
import type { Todo } from "../../../shared/appDomainTypes";

export type {
  DataSource,
  DataSourceType,
  SyncStatus,
  Todo,
  TodoStatus
} from "../../../shared/appDomainTypes";

export type TodoEventType =
  | "todo.created"
  | "todo.updated"
  | "todo.completed"
  | "todo.snoozed"
  | "todo.deleted"
  | "reminder.fired";

export type ReminderKind = "none" | "overdue" | "today" | "upcoming";

export interface TodoEvent {
  eventId: string;
  todoId: string;
  type: TodoEventType;
  payload: Record<string, unknown>;
  occurredAt: string;
  sourceDeviceId: string;
  syncStatus: "queued" | "synced" | "failed";
  retryCount: number;
}

export interface TodoMutationResult {
  todo: Todo;
  event: TodoEvent;
}
