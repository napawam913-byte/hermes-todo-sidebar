import { describe, expect, it } from "vitest";
import {
  createReminderLedger,
  getNextBlinkDelay,
  shouldEnterPetSleep,
  syncReminderLedger
} from "./petAmbientPolicy";

describe("petAmbientPolicy", () => {
  it("将下一次眨眼限制在 8 到 14 秒", () => {
    expect(getNextBlinkDelay(() => 0)).toBe(8_000);
    expect(getNextBlinkDelay(() => 0.5)).toBe(11_000);
    expect(getNextBlinkDelay(() => 1)).toBe(14_000);
  });

  it("仅在收起且连续无操作 20 分钟后睡眠", () => {
    const now = 1_300_000;
    expect(shouldEnterPetSleep({ expanded: false, lastInteractionAt: 100_000, now })).toBe(true);
    expect(shouldEnterPetSleep({ expanded: true, lastInteractionAt: 100_000, now })).toBe(false);
    expect(shouldEnterPetSleep({ expanded: false, lastInteractionAt: 100_001, now })).toBe(false);
  });

  it("每天首次展开仅提醒一次", () => {
    const first = syncReminderLedger({
      ledger: createReminderLedger("2026-07-21"),
      dateKey: "2026-07-21",
      attentionIds: ["todo-1"],
      expanded: true,
      notifyNewItems: false
    });
    expect(first.shouldRemind).toBe(true);

    const second = syncReminderLedger({
      ledger: first.ledger,
      dateKey: "2026-07-21",
      attentionIds: ["todo-1"],
      expanded: true,
      notifyNewItems: false
    });
    expect(second.shouldRemind).toBe(false);
  });

  it("运行中新增今日条目时只提醒一次，并在跨日后重置", () => {
    const baseline = syncReminderLedger({
      ledger: createReminderLedger("2026-07-21"),
      dateKey: "2026-07-21",
      attentionIds: ["todo-1"],
      expanded: false,
      notifyNewItems: false
    });
    const added = syncReminderLedger({
      ledger: baseline.ledger,
      dateKey: "2026-07-21",
      attentionIds: ["todo-1", "todo-2"],
      expanded: false,
      notifyNewItems: true
    });
    expect(added.shouldRemind).toBe(true);
    expect(syncReminderLedger({
      ledger: added.ledger,
      dateKey: "2026-07-21",
      attentionIds: ["todo-1", "todo-2"],
      expanded: false,
      notifyNewItems: true
    }).shouldRemind).toBe(false);

    const nextDay = syncReminderLedger({
      ledger: added.ledger,
      dateKey: "2026-07-22",
      attentionIds: ["todo-3"],
      expanded: true,
      notifyNewItems: false
    });
    expect(nextDay.shouldRemind).toBe(true);
  });
});
