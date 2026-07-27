/**
 * 模块用途：验证普通待办 UI 操作会生成通用变更合同。
 * 模块边界：只测试命令构造，不执行持久化或渲染组件。
 */
import { describe, expect, it } from "vitest";
import { mockTodos } from "./mockTodos";
import {
  buildCompleteTodoOperation,
  buildCreateTodoOperation,
  buildDeleteTodoOperation,
  buildReopenTodoOperation,
  buildUpdateTodoOperation
} from "./todoMutationCommands";

describe("todoMutationCommands", () => {
  const todo = mockTodos[0];

  it("builds create and update operations", () => {
    expect(buildCreateTodoOperation(" 训练 ", "2026-07-15")).toEqual({
      type: "todo.create", draft: { title: "训练", date: "2026-07-15" }
    });
    expect(buildUpdateTodoOperation(todo, {
      title: "新标题", date: "2026-07-16", notes: "备注"
    })).toEqual({
      type: "todo.update",
      targetId: todo.id,
      expectedUpdatedAt: todo.updatedAt,
      patch: { title: "新标题", date: "2026-07-16", notes: "备注" }
    });
  });

  it("builds complete, reopen and delete operations with versions", () => {
    expect(buildCompleteTodoOperation(todo)).toMatchObject({
      type: "todo.complete", targetId: todo.id, expectedUpdatedAt: todo.updatedAt
    });
    expect(buildReopenTodoOperation(todo)).toMatchObject({ type: "todo.reopen" });
    expect(buildDeleteTodoOperation(todo)).toMatchObject({ type: "todo.delete" });
  });
});
