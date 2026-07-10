/**
 * 模块用途：把提醒时间转换为用户可扫读的状态标签。
 * 模块边界：只展示提醒状态，不触发提醒调度。
 */
import { getReminderKind } from "./todoModel";

interface ReminderBadgeProps {
  remindAt?: string;
}
const labels = {
  none: "无提醒",
  overdue: "已到点",
  today: "今天",
  upcoming: "未来"
} as const;

export function ReminderBadge({ remindAt }: ReminderBadgeProps) {
  const kind = getReminderKind(remindAt, new Date());
  const time = remindAt
    ? new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(new Date(remindAt))
    : "";

  return (
    <span className={`reminder-badge reminder-${kind}`}>
      {labels[kind]}
      {time ? <span>{time}</span> : null}
    </span>
  );
}
