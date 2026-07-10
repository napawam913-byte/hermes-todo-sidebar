/**
 * 模块用途：定义系统通知服务接口，并提供当前阶段的空实现。
 * 模块边界：真实 Windows 通知后续在这里接入，不让 renderer 直接调用系统 API。
 */
import type { ReminderNotificationPayload } from "./reminderTypes.js";

export interface NotificationService {
  showReminder(payload: ReminderNotificationPayload): void | Promise<void>;
}

export function createDisabledNotificationService(): NotificationService {
  return {
    showReminder() {
      // 第一阶段只保留接口，不弹出系统通知。
    }
  };
}
