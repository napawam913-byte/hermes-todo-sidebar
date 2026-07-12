/**
 * 模块用途：提供浏览器 localStorage 版本的待办仓储，让桌宠原型具备本地持久化。
 * 模块边界：只负责序列化、反序列化和损坏数据降级，不处理 UI 状态或 Hermes 同步。
 */
import type { Todo, SyncStatus, TodoStatus } from "./types";
import type { TodoRepository } from "./todoRepository";
import { toLocalDateKey } from "./useLocalDateKey";

export const TODO_STORAGE_KEY = "hermes.todoSidebar.todos.v1";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTodoStatus(value: unknown): value is TodoStatus {
  return value === "pending" || value === "completed";
}

function isSyncStatus(value: unknown): value is SyncStatus {
  return value === "local" || value === "queued" || value === "synced" || value === "failed";
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function normalizeDateKey(value: unknown, createdAt: string): string | undefined {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const createdDate = new Date(createdAt);
  return Number.isNaN(createdDate.getTime()) ? undefined : toLocalDateKey(createdDate);
}

function normalizeTodo(value: unknown): Todo | undefined {
  if (!isRecord(value)) return undefined;
  if (typeof value.id !== "string") return undefined;
  if (typeof value.title !== "string") return undefined;
  if (!isTodoStatus(value.status)) return undefined;
  if (!isSyncStatus(value.syncStatus)) return undefined;
  if (typeof value.createdAt !== "string") return undefined;
  if (typeof value.updatedAt !== "string") return undefined;
  const date = normalizeDateKey(value.date, value.createdAt);
  if (!date) return undefined;

  return {
    id: value.id,
    title: value.title,
    date,
    notes: optionalString(value.notes),
    status: value.status,
    syncStatus: value.syncStatus,
    remindAt: optionalString(value.remindAt),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    completedAt: optionalString(value.completedAt),
    snoozeCount: typeof value.snoozeCount === "number" ? value.snoozeCount : 0
  };
}

export function normalizeTodos(value: unknown): Todo[] {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeTodo).filter((todo): todo is Todo => Boolean(todo));
}

export function createLocalTodoRepository(storage: StorageLike | null | undefined): TodoRepository {
  return {
    loadTodos() {
      if (!storage) return [];

      try {
        const rawValue = storage.getItem(TODO_STORAGE_KEY);
        if (!rawValue) return [];

        const parsed = JSON.parse(rawValue);
        return normalizeTodos(parsed);
      } catch {
        return [];
      }
    },
    saveTodos(todos) {
      if (!storage) return;

      try {
        storage.setItem(TODO_STORAGE_KEY, JSON.stringify(todos));
      } catch {
        // localStorage 可能被禁用或超额，桌宠 UI 不应因此崩溃。
      }
    }
  };
}
