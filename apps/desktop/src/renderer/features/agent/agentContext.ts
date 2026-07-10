/**
 * 模块用途：从当前待办列表生成 Agent 可用的最小上下文快照。
 * 模块边界：只提取必要字段，不传 UI 状态、同步细节、备注或系统权限信息。
 */
import type { Todo } from "../todos/types";
import type { AgentContextSnapshot, AgentTodoContext } from "./agentTypes";

function isSameLocalDate(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function toAgentTodoContext(todo: Todo): AgentTodoContext {
  return {
    id: todo.id,
    title: todo.title,
    status: todo.status,
    remindAt: todo.remindAt,
    snoozeCount: todo.snoozeCount
  };
}

export function createAgentContextSnapshot(todos: Todo[], now: Date): AgentContextSnapshot {
  const nowTime = now.getTime();

  const summary = todos.reduce(
    (currentSummary, todo) => {
      if (todo.status === "pending") currentSummary.pendingCount += 1;
      if (todo.status === "completed") currentSummary.completedCount += 1;
      if (!todo.remindAt) return currentSummary;

      const reminder = new Date(todo.remindAt);
      if (Number.isNaN(reminder.getTime())) return currentSummary;

      if (todo.status === "pending" && reminder.getTime() < nowTime) {
        currentSummary.overdueCount += 1;
      }
      if (todo.status === "pending" && isSameLocalDate(reminder, now)) {
        currentSummary.todayCount += 1;
      }

      return currentSummary;
    },
    {
      pendingCount: 0,
      overdueCount: 0,
      todayCount: 0,
      completedCount: 0
    }
  );

  return {
    capturedAt: now.toISOString(),
    todos: todos.map(toAgentTodoContext),
    summary
  };
}
