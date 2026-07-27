/**
 * 模块用途：把今日/逾期待办变化转成去重后的桌宠提醒事件。
 * 模块边界：只保存非敏感提醒账本，不修改待办，也不控制徽标展示。
 */
import { useEffect, useRef } from "react";
import {
  createReminderLedger,
  parseReminderLedger,
  syncReminderLedger,
  type PetReminderLedgerV1
} from "./petAmbientPolicy";

const STORAGE_KEY = "hermes.pet.reminder-ledger.v1";

interface PetReminderSignalsOptions {
  attentionIds: string[];
  dateKey: string;
  expanded: boolean;
  onRemind(): void;
}

export function usePetReminderSignals(options: PetReminderSignalsOptions): void {
  const initialized = useRef(false);
  const syncedOnce = useRef(false);
  const ledger = useRef<PetReminderLedgerV1>(createReminderLedger(options.dateKey));

  useEffect(() => {
    if (initialized.current) return;
    ledger.current = parseReminderLedger(readStoredLedger(), options.dateKey);
    initialized.current = true;
  }, [options.dateKey]);

  useEffect(() => {
    if (!initialized.current) return;
    const result = syncReminderLedger({
      ledger: ledger.current,
      dateKey: options.dateKey,
      attentionIds: options.attentionIds,
      expanded: options.expanded,
      notifyNewItems: syncedOnce.current
    });
    syncedOnce.current = true;
    ledger.current = result.ledger;
    storeLedger(result.ledger);
    if (result.shouldRemind) options.onRemind();
  }, [options.attentionIds.join("|"), options.dateKey, options.expanded, options.onRemind]);
}

function readStoredLedger(): string | null {
  try {
    return globalThis.localStorage?.getItem(STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

function storeLedger(ledger: PetReminderLedgerV1): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(ledger));
  } catch {
    // 非关键提醒偏好写入失败时，当前会话仍可继续使用。
  }
}
