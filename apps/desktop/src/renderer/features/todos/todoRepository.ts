/**
 * 模块用途：定义待办数据读写仓储接口，隔离 UI 与具体存储方式。
 * 模块边界：只定义本地读写契约，不实现 React 状态、网络同步或 Electron 文件存储。
 */
import type { Todo } from "./types";

export interface TodoRepository {
  loadTodos(): Todo[];
  saveTodos(todos: Todo[]): void;
}
