/**
 * 模块用途：提供第一阶段前端原型使用的本地 mock 待办数据。
 * 模块边界：只提供静态数据，不模拟远端同步。
 */
import type { Todo } from "./types";

export const mockTodos: Todo[] = [
  {
    id: "todo_ui_review",
    title: "整理待办桌宠第一版界面",
    notes: "只保留新增、完成和同步状态占位。",
    status: "pending",
    syncStatus: "synced",
    createdAt: "2026-07-08T09:00:00.000Z",
    updatedAt: "2026-07-08T09:00:00.000Z",
    snoozeCount: 0
  },
  {
    id: "todo_motion_doc",
    title: "确认待办列表视觉密度",
    status: "pending",
    syncStatus: "queued",
    createdAt: "2026-07-08T09:20:00.000Z",
    updatedAt: "2026-07-08T09:20:00.000Z",
    snoozeCount: 0
  },
  {
    id: "todo_sync_placeholder",
    title: "标注 Hermes/飞书同步占位",
    notes: "先显示状态，不实际联网。",
    status: "pending",
    syncStatus: "failed",
    createdAt: "2026-07-08T09:40:00.000Z",
    updatedAt: "2026-07-08T09:40:00.000Z",
    snoozeCount: 0
  }
];
