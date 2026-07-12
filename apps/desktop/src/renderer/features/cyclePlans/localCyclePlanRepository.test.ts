/**
 * 模块用途：验证周期计划 v2 的本地保存、旧数据兼容和损坏数据降级。
 * 模块边界：只测试仓储序列化，不访问 React、Hermes 或 Electron。
 */
import { describe, expect, it } from "vitest";
import {
  CYCLE_PLAN_STORAGE_KEY,
  LEGACY_CYCLE_PLAN_STORAGE_KEY,
  createLocalCyclePlanRepository,
  normalizeCyclePlans
} from "./localCyclePlanRepository";
import { mockCyclePlans } from "./mockCyclePlans";

function createMemoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));

  return {
    getItem(key: string) {
      return data.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      data.set(key, value);
    }
  };
}

describe("createLocalCyclePlanRepository", () => {
  it("filters malformed plans from an unknown application state", () => {
    expect(normalizeCyclePlans([mockCyclePlans[0], { broken: true }])).toEqual([
      mockCyclePlans[0]
    ]);
  });

  it("saves the canonical schema under the v2 storage key", () => {
    const storage = createMemoryStorage();
    const repository = createLocalCyclePlanRepository(storage);

    repository.savePlans(mockCyclePlans);

    expect(storage.getItem(CYCLE_PLAN_STORAGE_KEY)).toBe(JSON.stringify(mockCyclePlans));
  });

  it("normalizes legacy string sources into v2 source objects", () => {
    const legacyPlan = {
      id: "legacy_plan",
      title: "旧健身计划",
      topic: "健身",
      description: "兼容读取测试",
      status: "active",
      source: "manual",
      createdAt: "2026-07-10T08:00:00.000Z",
      updatedAt: "2026-07-10T08:00:00.000Z",
      entries: [{
        id: "legacy_entry",
        planId: "legacy_plan",
        date: "2026-07-10",
        title: "上肢训练",
        contentSummary: "卧推和划船",
        status: "pending",
        source: "hermes",
        createdAt: "2026-07-10T08:00:00.000Z",
        updatedAt: "2026-07-10T08:00:00.000Z",
        contentBlocks: [{
          id: "legacy_block",
          kind: "fitness.exercise_list",
          title: "训练动作",
          format: "json",
          data: { exercises: [{ name: "卧推" }] }
        }]
      }]
    };
    const repository = createLocalCyclePlanRepository(createMemoryStorage({
      [LEGACY_CYCLE_PLAN_STORAGE_KEY]: JSON.stringify([legacyPlan])
    }));

    const [plan] = repository.loadPlans();

    expect(plan).toMatchObject({ schemaVersion: 2, source: { type: "manual" } });
    expect(plan.entries[0]).toMatchObject({ schemaVersion: 2, source: { type: "hermes" } });
    expect(plan.entries[0].contentBlocks[0]).toMatchObject({ schemaVersion: 2 });
  });
});
