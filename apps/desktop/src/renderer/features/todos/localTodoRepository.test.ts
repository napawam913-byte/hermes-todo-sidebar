/**
 * 模块用途：验证本地待办仓储的保存、读取和损坏数据降级行为。
 * 模块边界：只测试仓储接口，不触碰 React 组件或 Electron 主进程。
 */
import { describe, expect, it } from "vitest";
import { createLocalTodoRepository } from "./localTodoRepository";
import type { Todo } from "./types";

function createMemoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));

  return {
    getItem(key: string) {
      return data.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      data.set(key, value);
    }
  };
}

function makeTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: "todo_1",
    title: "确认桌宠待办持久化",
    date: "2026-07-08",
    status: "pending",
    syncStatus: "queued",
    createdAt: "2026-07-08T09:00:00.000Z",
    updatedAt: "2026-07-08T09:00:00.000Z",
    snoozeCount: 0,
    ...overrides
  };
}

describe("createLocalTodoRepository", () => {
  it("saves and loads todos through the provided storage", () => {
    const repository = createLocalTodoRepository(createMemoryStorage());
    const todo = makeTodo();

    repository.saveTodos([todo]);

    expect(repository.loadTodos()).toEqual([todo]);
  });

  it("returns an empty list when saved data is broken", () => {
    const repository = createLocalTodoRepository(createMemoryStorage({
      "hermes.todoSidebar.todos.v1": "{bad json"
    }));

    expect(repository.loadTodos()).toEqual([]);
  });

  it("filters malformed rows instead of crashing the sidebar", () => {
    const repository = createLocalTodoRepository(createMemoryStorage({
      "hermes.todoSidebar.todos.v1": JSON.stringify([
        makeTodo({ id: "todo_ok" }),
        { id: "todo_bad", title: 42 }
      ])
    }));

    expect(repository.loadTodos()).toEqual([makeTodo({ id: "todo_ok" })]);
  });

  it("migrates legacy todos without a date from their local creation date", () => {
    const legacyTodo = { ...makeTodo() } as Record<string, unknown>;
    delete legacyTodo.date;
    const repository = createLocalTodoRepository(createMemoryStorage({
      "hermes.todoSidebar.todos.v1": JSON.stringify([legacyTodo])
    }));

    expect(repository.loadTodos()[0].date).toBe("2026-07-08");
  });

  it("drops legacy plan entry snapshots so cycle entries remain the single source of truth", () => {
    const todo = makeTodo({ title: "上肢力量训练" });
    const repository = createLocalTodoRepository(createMemoryStorage({
      "hermes.todoSidebar.todos.v1": JSON.stringify([{
        ...todo,
        planEntry: {
          entryId: "legacy_entry",
          legacy: true
        }
      }])
    }));

    expect(repository.loadTodos()).toEqual([todo]);
  });
});
