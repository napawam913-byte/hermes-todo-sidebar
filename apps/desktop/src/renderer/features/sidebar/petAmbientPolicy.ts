/**
 * 模块用途：定义安静闲置所需的眨眼、睡眠和每日提醒去重规则。
 * 模块边界：只计算策略结果，不创建浏览器计时器，也不直接读写 localStorage。
 */
const BLINK_MIN_MS = 8_000;
const BLINK_RANGE_MS = 6_000;
export const PET_SLEEP_AFTER_MS = 20 * 60 * 1_000;

export interface PetReminderLedgerV1 {
  schemaVersion: 1;
  dateKey: string;
  dailyOpenReminded: boolean;
  knownAttentionIds: string[];
}

interface SleepCheckInput {
  expanded: boolean;
  lastInteractionAt: number;
  now: number;
}

interface ReminderSyncInput {
  ledger: PetReminderLedgerV1;
  dateKey: string;
  attentionIds: string[];
  expanded: boolean;
  notifyNewItems: boolean;
}

export function getNextBlinkDelay(random: () => number = Math.random): number {
  const sample = Math.min(1, Math.max(0, random()));
  return Math.round(BLINK_MIN_MS + BLINK_RANGE_MS * sample);
}

export function shouldEnterPetSleep(input: SleepCheckInput): boolean {
  return !input.expanded && input.now - input.lastInteractionAt >= PET_SLEEP_AFTER_MS;
}

export function createReminderLedger(dateKey: string): PetReminderLedgerV1 {
  return {
    schemaVersion: 1,
    dateKey,
    dailyOpenReminded: false,
    knownAttentionIds: []
  };
}

export function syncReminderLedger(input: ReminderSyncInput): {
  ledger: PetReminderLedgerV1;
  shouldRemind: boolean;
} {
  const current = input.ledger.dateKey === input.dateKey
    ? input.ledger
    : createReminderLedger(input.dateKey);
  const attentionIds = [...new Set(input.attentionIds)].sort();
  const known = new Set(current.knownAttentionIds);
  const hasNewItems = attentionIds.some((id) => !known.has(id));
  const remindOnOpen = input.expanded
    && attentionIds.length > 0
    && !current.dailyOpenReminded;
  const remindForNewItem = input.notifyNewItems && hasNewItems;

  return {
    shouldRemind: remindOnOpen || remindForNewItem,
    ledger: {
      ...current,
      dateKey: input.dateKey,
      dailyOpenReminded: current.dailyOpenReminded || remindOnOpen,
      knownAttentionIds: attentionIds
    }
  };
}

export function parseReminderLedger(value: string | null, dateKey: string): PetReminderLedgerV1 {
  if (!value) return createReminderLedger(dateKey);
  try {
    const parsed = JSON.parse(value) as Partial<PetReminderLedgerV1>;
    if (
      parsed.schemaVersion === 1
      && typeof parsed.dateKey === "string"
      && typeof parsed.dailyOpenReminded === "boolean"
      && Array.isArray(parsed.knownAttentionIds)
      && parsed.knownAttentionIds.every((id) => typeof id === "string")
    ) {
      return parsed as PetReminderLedgerV1;
    }
  } catch {
    // 损坏的非关键偏好直接回退，不阻止桌宠启动。
  }
  return createReminderLedger(dateKey);
}
