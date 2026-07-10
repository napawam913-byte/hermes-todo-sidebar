/**
 * 模块用途：定义主进程提醒调度需要的最小待办与通知载荷类型。
 * 模块边界：避免主进程依赖完整 React 待办模型，便于后续替换为真实系统提醒。
 */
export type ReminderTodoStatus = "pending" | "completed";

export interface ReminderTodo {
  id: string;
  title: string;
  status: ReminderTodoStatus;
  remindAt?: string;
}

export interface ReminderNotificationPayload {
  todoId: string;
  title: string;
  remindAt: string;
  firedAt: string;
}
