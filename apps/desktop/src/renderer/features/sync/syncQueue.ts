/**
 * 模块用途：维护待上传到 Hermes 的本地同步事件队列。
 * 模块边界：只处理队列状态变化，不发起网络请求，也不直接操作待办列表。
 */
import type { TodoEvent } from "../todos/types";
import type { SyncQueueState } from "./syncTypes";

export function createEmptySyncQueueState(): SyncQueueState {
  return {
    entries: []
  };
}

export function enqueueSyncEvent(
  state: SyncQueueState,
  event: TodoEvent,
  enqueuedAt = event.occurredAt
): SyncQueueState {
  const nextEntry = {
    event: {
      ...event,
      syncStatus: "queued" as const
    },
    enqueuedAt
  };
  const remainingEntries = state.entries.filter((entry) => entry.event.eventId !== event.eventId);

  return {
    ...state,
    entries: [nextEntry, ...remainingEntries]
  };
}

export function getPendingSyncEvents(state: SyncQueueState): TodoEvent[] {
  return state.entries
    .filter((entry) => entry.event.syncStatus === "queued" || entry.event.syncStatus === "failed")
    .map((entry) => entry.event);
}

export function markEventsSynced(
  state: SyncQueueState,
  eventIds: string[],
  syncedAt: string
): SyncQueueState {
  const eventIdSet = new Set(eventIds);

  return {
    ...state,
    lastSyncedAt: syncedAt,
    entries: state.entries.map((entry) => {
      if (!eventIdSet.has(entry.event.eventId)) return entry;

      return {
        ...entry,
        event: {
          ...entry.event,
          syncStatus: "synced" as const
        },
        lastAttemptAt: syncedAt,
        lastError: undefined
      };
    })
  };
}

export function markEventsFailed(
  state: SyncQueueState,
  eventIds: string[],
  error: string,
  failedAt: string
): SyncQueueState {
  const eventIdSet = new Set(eventIds);

  return {
    ...state,
    entries: state.entries.map((entry) => {
      if (!eventIdSet.has(entry.event.eventId)) return entry;

      return {
        ...entry,
        event: {
          ...entry.event,
          syncStatus: "failed" as const,
          retryCount: entry.event.retryCount + 1
        },
        lastAttemptAt: failedAt,
        lastError: error
      };
    })
  };
}
