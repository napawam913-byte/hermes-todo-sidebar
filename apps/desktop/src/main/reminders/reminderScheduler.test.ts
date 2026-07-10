/**
 * 模块用途：验证系统提醒调度前的到点待办筛选规则。
 * 模块边界：只做纯数据筛选，不弹 Windows 通知。
 */
import { describe, expect, it } from "vitest";
import { findDueReminders } from "./reminderScheduler.js";
import type { ReminderTodo } from "./reminderTypes.js";

function makeReminderTodo(overrides: Partial<ReminderTodo> = {}): ReminderTodo {
  return {
    id: "todo_1",
    title: "到点提醒",
    status: "pending",
    remindAt: "2026-07-08T09:00:00.000Z",
    ...overrides
  };
}

describe("findDueReminders", () => {
  it("returns pending todos whose reminder time has arrived", () => {
    const now = new Date("2026-07-08T09:10:00.000Z");
    const due = makeReminderTodo({ id: "due" });
    const future = makeReminderTodo({ id: "future", remindAt: "2026-07-08T09:20:00.000Z" });
    const completed = makeReminderTodo({ id: "completed", status: "completed" });
    const noReminder = makeReminderTodo({ id: "no-reminder", remindAt: undefined });

    expect(findDueReminders([future, due, completed, noReminder], now).map((todo) => todo.id)).toEqual(["due"]);
  });

  it("skips reminders that were already fired in the current app session", () => {
    const now = new Date("2026-07-08T09:10:00.000Z");
    const firedIds = new Set(["already-fired"]);
    const todos = [
      makeReminderTodo({ id: "already-fired" }),
      makeReminderTodo({ id: "new-due" })
    ];

    expect(findDueReminders(todos, now, firedIds).map((todo) => todo.id)).toEqual(["new-due"]);
  });
});
