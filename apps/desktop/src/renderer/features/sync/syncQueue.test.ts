/**
 * 模块用途：验证 Hermes 同步队列的入队、成功确认和失败重试状态。
 * 模块边界：只测试前端同步队列数据结构，不发起网络请求。
 */
import { describe, expect, it } from "vitest";
import {
  createEmptySyncQueueState,
  enqueueSyncEvent,
  getPendingSyncEvents,
  markEventsFailed,
  markEventsSynced
} from "./syncQueue";
import type { TodoEvent } from "../todos/types";

function makeEvent(overrides: Partial<TodoEvent> = {}): TodoEvent {
  return {
    eventId: "evt_1",
    todoId: "todo_1",
    type: "todo.created",
    payload: { title: "写 Hermes 同步接口" },
    occurredAt: "2026-07-08T09:00:00.000Z",
    sourceDeviceId: "desktop-prototype",
    syncStatus: "queued",
    retryCount: 0,
    ...overrides
  };
}

describe("syncQueue", () => {
  it("keeps newly enqueued events pending until Hermes confirms them", () => {
    const state = enqueueSyncEvent(createEmptySyncQueueState(), makeEvent());

    expect(getPendingSyncEvents(state).map((event) => event.eventId)).toEqual(["evt_1"]);

    const synced = markEventsSynced(state, ["evt_1"], "2026-07-08T09:01:00.000Z");

    expect(getPendingSyncEvents(synced)).toEqual([]);
    expect(synced.entries[0].event.syncStatus).toBe("synced");
    expect(synced.lastSyncedAt).toBe("2026-07-08T09:01:00.000Z");
  });

  it("records failures without dropping the event from retry candidates", () => {
    const state = enqueueSyncEvent(createEmptySyncQueueState(), makeEvent());
    const failed = markEventsFailed(state, ["evt_1"], "Hermes offline", "2026-07-08T09:02:00.000Z");

    expect(failed.entries[0].event.syncStatus).toBe("failed");
    expect(failed.entries[0].event.retryCount).toBe(1);
    expect(failed.entries[0].lastError).toBe("Hermes offline");
    expect(getPendingSyncEvents(failed).map((event) => event.eventId)).toEqual(["evt_1"]);
  });
});
