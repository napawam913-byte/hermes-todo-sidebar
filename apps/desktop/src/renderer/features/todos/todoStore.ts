/**
 * 模块用途：把待办纯函数、仓储和 React 状态连接起来，供桌宠面板使用。
 * 模块边界：只管理前端待办状态，不直接调用 Hermes、飞书或 Windows 通知。
 */
// [待删除-2026-07-15]
// 原用途：由 renderer store 直接保存普通待办数组。
// 替代方案：AppMutationGateway + useAppMutationStore 统一执行操作、校验和原子保存。
// 删除条件：用户确认 0.1.3-test.4 手动 CRUD 与重启持久化稳定后再请求许可。
import { useCallback, useState } from "react";
import { completeTodo, createTodoDraft, snoozeTodo } from "./todoModel";
import type { Todo, TodoMutationResult } from "./types";
import type { TodoRepository } from "./todoRepository";

interface UseTodoStoreOptions {
  repository: TodoRepository;
  initialTodos: Todo[];
  sourceDeviceId: string;
}

interface TodoStoreState {
  todos: Todo[];
  addTodo(title: string, remindAt?: Date): TodoMutationResult;
  completeTodo(todo: Todo): TodoMutationResult;
  hydrateTodos(todos: Todo[]): void;
  snoozeTodo(todo: Todo, minutes: number): TodoMutationResult;
}

function loadInitialTodos(repository: TodoRepository, fallbackTodos: Todo[]) {
  const persistedTodos = repository.loadTodos();
  return persistedTodos.length > 0 ? persistedTodos : fallbackTodos;
}

export function useTodoStore(options: UseTodoStoreOptions): TodoStoreState {
  const { initialTodos, repository, sourceDeviceId } = options;
  const [todos, setTodos] = useState<Todo[]>(() => loadInitialTodos(repository, initialTodos));

  const commitTodos = useCallback(
    (nextTodos: (currentTodos: Todo[]) => Todo[]) => {
      setTodos((currentTodos) => {
        const updatedTodos = nextTodos(currentTodos);
        repository.saveTodos(updatedTodos);
        return updatedTodos;
      });
    },
    [repository]
  );

  const addTodo = useCallback(
    (title: string, remindAt?: Date) => {
      const result = createTodoDraft({
        title,
        remindAt,
        now: new Date(),
        sourceDeviceId
      });
      commitTodos((currentTodos) => [result.todo, ...currentTodos]);
      return result;
    },
    [commitTodos, sourceDeviceId]
  );

  const completeExistingTodo = useCallback(
    (todo: Todo) => {
      const result = completeTodo(todo, new Date());
      commitTodos((currentTodos) =>
        currentTodos.map((currentTodo) => (currentTodo.id === result.todo.id ? result.todo : currentTodo))
      );
      return result;
    },
    [commitTodos]
  );

  const snoozeExistingTodo = useCallback(
    (todo: Todo, minutes: number) => {
      const result = snoozeTodo(todo, minutes, new Date());
      commitTodos((currentTodos) =>
        currentTodos.map((currentTodo) => (currentTodo.id === result.todo.id ? result.todo : currentTodo))
      );
      return result;
    },
    [commitTodos]
  );

  const hydrateTodos = useCallback((nextTodos: Todo[]) => {
    setTodos(nextTodos);
  }, []);

  return {
    todos,
    addTodo,
    completeTodo: completeExistingTodo,
    hydrateTodos,
    snoozeTodo: snoozeExistingTodo
  };
}
