/**
 * 模块用途：验证 Agent 上下文快照只包含必要待办信息。
 * 模块边界：只测试上下文提取，不触发 Agent 请求或 UI 渲染。
 */
import { describe, expect, it } from "vitest";
import { createAgentContextSnapshot } from "./agentContext";
import type { Todo } from "../todos/types";

function makeTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: "todo_1",
    title: "整理今日待办",
    date: "2026-07-09",
    notes: "不应传给 Agent 的详细备注",
    status: "pending",
    syncStatus: "failed",
    source: { type: "manual" },
    remindAt: "2026-07-09T09:30:00.000Z",
    createdAt: "2026-07-09T08:00:00.000Z",
    updatedAt: "2026-07-09T08:00:00.000Z",
    completedAt: undefined,
    snoozeCount: 1,
    ...overrides
  };
}

describe("createAgentContextSnapshot", () => {
  it("keeps only minimal todo fields that Agent needs for suggestions", () => {
    const snapshot = createAgentContextSnapshot(
      [makeTodo()],
      new Date("2026-07-09T09:00:00.000Z")
    );

    expect(snapshot.todos).toEqual([
      {
        id: "todo_1",
        title: "整理今日待办",
        status: "pending",
        remindAt: "2026-07-09T09:30:00.000Z",
        snoozeCount: 1
      }
    ]);
    expect(snapshot.todos[0]).not.toHaveProperty("notes");
    expect(snapshot.todos[0]).not.toHaveProperty("syncStatus");
  });

  it("summarizes pending, overdue, today, and completed counts", () => {
    const snapshot = createAgentContextSnapshot(
      [
        makeTodo({ id: "overdue", remindAt: "2026-07-09T08:30:00.000Z" }),
        makeTodo({ id: "today", remindAt: "2026-07-09T10:00:00.000Z" }),
        makeTodo({ id: "future", remindAt: "2026-07-10T10:00:00.000Z" }),
        makeTodo({ id: "done", status: "completed" })
      ],
      new Date("2026-07-09T09:00:00.000Z")
    );

    expect(snapshot.summary).toEqual({
      pendingCount: 3,
      overdueCount: 1,
      todayCount: 2,
      completedCount: 1
    });
  });
});
