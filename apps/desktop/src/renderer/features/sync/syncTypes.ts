/**
 * 模块用途：定义 Hermes/飞书同步占位层的数据结构，便于后续接入真实云端。
 * 模块边界：只放同步类型，不实现网络请求、鉴权或 UI 渲染。
 */
import type { Todo, TodoEvent } from "../todos/types";

export type HermesConnectionState = "disabled" | "local-only" | "connecting" | "ready" | "failed";
export type FeishuDeliveryTarget = "feishu.bot" | "feishu.bitable";

export interface HermesSyncConfig {
  enabled: boolean;
  endpoint?: string;
  feishuTargets: FeishuDeliveryTarget[];
}

export interface SyncQueueEntry {
  event: TodoEvent;
  enqueuedAt: string;
  lastAttemptAt?: string;
  lastError?: string;
}

export interface SyncQueueState {
  entries: SyncQueueEntry[];
  lastSyncedAt?: string;
}

export interface SyncPushResult {
  acceptedEventIds: string[];
  failedEventIds: string[];
  message?: string;
}

export interface SyncPullResult {
  todos: Todo[];
  pulledAt?: string;
  message?: string;
}
