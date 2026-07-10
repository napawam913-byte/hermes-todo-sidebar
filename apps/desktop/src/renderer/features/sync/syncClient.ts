/**
 * 模块用途：定义 Hermes 同步客户端接口，并提供当前阶段禁用网络的安全占位实现。
 * 模块边界：不在前端直接连接飞书；飞书发送与记录后续由 Hermes 服务端代理。
 */
import type { TodoEvent } from "../todos/types";
import type { SyncPullResult, SyncPushResult } from "./syncTypes";

export interface HermesSyncClient {
  pushEvents(events: TodoEvent[]): Promise<SyncPushResult>;
  pullTodos(): Promise<SyncPullResult>;
}

export function createDisabledHermesSyncClient(): HermesSyncClient {
  return {
    async pushEvents(events) {
      return {
        acceptedEventIds: [],
        failedEventIds: events.map((event) => event.eventId),
        message: "Hermes 同步尚未启用，事件保留在本地队列。"
      };
    },
    async pullTodos() {
      return {
        todos: [],
        message: "Hermes 同步尚未启用。"
      };
    }
  };
}
