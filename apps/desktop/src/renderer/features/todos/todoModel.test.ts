import { describe, expect, it } from "vitest";
import {
  completeTodo,
  createTodoDraft,
  getReminderKind,
  sortTodosForSimpleList,
  sortTodosForTodayFirst,
  snoozeTodo
} from "./todoModel";
import type { Todo } from "./types";

describe("todoModel", () => {
  it("creates a pending todo and queued create event from trimmed input", () => {
    const now = new Date("2026-07-08T09:00:00.000Z");
    const remindAt = new Date("2026-07-08T10:30:00.000Z");

    const result = createTodoDraft({
      title: "  写 Hermes 侧边栏方案  ",
      remindAt,
      now,
      sourceDeviceId: "desktop-dev"
    });

    expect(result.todo.title).toBe("写 Hermes 侧边栏方案");
    expect(result.todo.date).toBe("2026-07-08");
    expect(result.todo.status).toBe("pending");
    expect(result.todo.remindAt).toBe(remindAt.toISOString());
    expect(result.event.type).toBe("todo.created");
    expect(result.event.syncStatus).toBe("queued");
    expect(result.event.sourceDeviceId).toBe("desktop-dev");
  });

  it("marks a todo completed and emits a completed event", () => {
    const created = createTodoDraft({
      title: "整理动效文档",
      now: new Date("2026-07-08T09:00:00.000Z"),
      sourceDeviceId: "desktop-dev"
    });
    const completedAt = new Date("2026-07-08T09:20:00.000Z");

    const result = completeTodo(created.todo, completedAt);

    expect(result.todo.status).toBe("completed");
    expect(result.todo.completedAt).toBe(completedAt.toISOString());
    expect(result.event.type).toBe("todo.completed");
    expect(result.event.todoId).toBe(created.todo.id);
  });

  it("snoozes a todo by preset minutes and increments snooze count", () => {
    const created = createTodoDraft({
      title: "确认 Figma 组件",
      now: new Date("2026-07-08T09:00:00.000Z"),
      sourceDeviceId: "desktop-dev"
    });
    const now = new Date("2026-07-08T09:30:00.000Z");

    const result = snoozeTodo(created.todo, 15, now);

    expect(result.todo.remindAt).toBe("2026-07-08T09:45:00.000Z");
    expect(result.todo.snoozeCount).toBe(1);
    expect(result.event.type).toBe("todo.snoozed");
  });

  it("classifies reminders for badge display", () => {
    const now = new Date(2026, 6, 8, 12, 0, 0);
    const overdue = new Date(2026, 6, 8, 11, 59, 0).toISOString();
    const laterToday = new Date(2026, 6, 8, 18, 0, 0).toISOString();
    const tomorrow = new Date(2026, 6, 9, 9, 0, 0).toISOString();

    expect(getReminderKind(undefined, now)).toBe("none");
    expect(getReminderKind(overdue, now)).toBe("overdue");
    expect(getReminderKind(laterToday, now)).toBe("today");
    expect(getReminderKind(tomorrow, now)).toBe("upcoming");
  });

  it("sorts pending todos by overdue first, today second, then future or unscheduled", () => {
    const now = new Date(2026, 6, 8, 12, 0, 0);
    const makeTodo = (id: string, remindAt?: Date): Todo => ({
      id,
      title: id,
      date: "2026-07-08",
      status: "pending",
      syncStatus: "local",
      remindAt: remindAt?.toISOString(),
      createdAt: new Date(2026, 6, 8, 8, 0, 0).toISOString(),
      updatedAt: new Date(2026, 6, 8, 8, 0, 0).toISOString(),
      snoozeCount: 0
    });

    const sorted = sortTodosForTodayFirst(
      [
        makeTodo("unscheduled"),
        makeTodo("future", new Date(2026, 6, 9, 9, 0, 0)),
        makeTodo("today", new Date(2026, 6, 8, 18, 0, 0)),
        makeTodo("overdue", new Date(2026, 6, 8, 11, 30, 0))
      ],
      now
    );

    expect(sorted.map((todo) => todo.id)).toEqual(["overdue", "today", "future", "unscheduled"]);
  });

  it("sorts first-version todos without using reminder time priority", () => {
    const makeTodo = (id: string, createdAt: string, remindAt?: Date): Todo => ({
      id,
      title: id,
      date: "2026-07-08",
      status: "pending",
      syncStatus: "local",
      remindAt: remindAt?.toISOString(),
      createdAt,
      updatedAt: createdAt,
      snoozeCount: 0
    });

    const sorted = sortTodosForSimpleList([
      makeTodo("older-overdue", "2026-07-08T08:00:00.000Z", new Date("2026-07-08T09:00:00.000Z")),
      makeTodo("newer-plain", "2026-07-08T10:00:00.000Z")
    ]);

    expect(sorted.map((todo) => todo.id)).toEqual(["newer-plain", "older-overdue"]);
  });
});
