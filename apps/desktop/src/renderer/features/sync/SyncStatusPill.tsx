/**
 * 模块用途：展示本地任务与 Hermes/飞书同步队列的当前状态。
 * 模块边界：只做状态可视化，不执行同步请求。
 */
import type { SyncStatus } from "../todos/types";

interface SyncStatusPillProps {
  status: SyncStatus;
}
const labels: Record<SyncStatus, string> = {
  local: "本地",
  queued: "待同步",
  synced: "已同步",
  failed: "同步失败"
};

export function SyncStatusPill({ status }: SyncStatusPillProps) {
  return <span className={`sync-pill sync-${status}`}>{labels[status]}</span>;
}
