/**
 * 模块用途：筛选已经到点且尚未触发过的待办，供后续 Windows 通知调度使用。
 * 模块边界：只做纯函数判断，不创建定时器、不调用 Electron Notification。
 */
import type { ReminderTodo } from "./reminderTypes.js";

export function findDueReminders(
  todos: ReminderTodo[],
  now: Date,
  alreadyFiredIds: ReadonlySet<string> = new Set()
): ReminderTodo[] {
  const nowTime = now.getTime();

  return todos.filter((todo) => {
    if (todo.status !== "pending") return false;
    if (!todo.remindAt) return false;
    if (alreadyFiredIds.has(todo.id)) return false;

    const reminderTime = new Date(todo.remindAt).getTime();
    if (Number.isNaN(reminderTime)) return false;

    return reminderTime <= nowTime;
  });
}
