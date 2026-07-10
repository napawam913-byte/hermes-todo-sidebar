/**
 * 模块用途：验证周期计划的日期命中、完成状态和内容块保留规则。
 * 模块边界：只覆盖纯函数，不访问 React、本地存储或 Hermes。
 */
import { describe, expect, it } from "vitest";
import {
  completeCyclePlanEntry,
  getCycleEntriesForDate,
  getCyclePlanStats,
  isFitnessExerciseListBlock
} from "./cyclePlanModel";
import { mockCyclePlans } from "./mockCyclePlans";

describe("cyclePlanModel", () => {
  it("uses the v2 unified schema without time scheduling fields", () => {
    for (const plan of mockCyclePlans) {
      expect(plan.schemaVersion).toBe(2);
      expect(plan.source).toMatchObject({ type: expect.any(String) });

      for (const entry of plan.entries) {
        expect(entry.schemaVersion).toBe(2);
        expect(entry.source).toMatchObject({ type: expect.any(String) });
        expect(entry).not.toHaveProperty("time");
        expect(entry).not.toHaveProperty("preferredTime");

        for (const block of entry.contentBlocks) {
          expect(block.schemaVersion).toBe(2);
        }
      }
    }
  });

  it("only returns entries that match the requested date", () => {
    const entries = getCycleEntriesForDate(mockCyclePlans, "2026-07-10");

    expect(entries.map((entry) => entry.title)).toEqual([
      "上肢力量训练",
      "教程第 3 章学习"
    ]);
    expect(entries.every((entry) => entry.date === "2026-07-10")).toBe(true);
  });

  it("does not expose unconfirmed candidate entries in today todos", () => {
    const plan = {
      ...mockCyclePlans[0],
      entries: [{ ...mockCyclePlans[0].entries[0], status: "candidate" as const }]
    };

    expect(getCycleEntriesForDate([plan], "2026-07-10")).toEqual([]);
  });

  it("keeps fitness exercise JSON available for dedicated rendering", () => {
    const entry = getCycleEntriesForDate(mockCyclePlans, "2026-07-10")[0];
    const block = entry.contentBlocks[0];

    expect(isFitnessExerciseListBlock(block)).toBe(true);
    expect(block.data.exercises).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "卧推",
          sets: [
            { reps: 15, rir: 3 },
            { reps: 12, rir: 3 },
            { reps: 12, rir: 3 }
          ]
        })
      ])
    );
  });

  it("marks one entry completed without losing content blocks", () => {
    const result = completeCyclePlanEntry(mockCyclePlans, "cycle_fitness_2026_07_10", new Date("2026-07-10T10:00:00.000Z"));
    const completed = getCycleEntriesForDate(result.plans, "2026-07-10").find(
      (entry) => entry.id === "cycle_fitness_2026_07_10"
    );

    expect(completed?.status).toBe("completed");
    expect(completed?.completedAt).toBe("2026-07-10T10:00:00.000Z");
    expect(completed?.contentBlocks[0].kind).toBe("fitness.exercise_list");
  });

  it("counts total entries and today hits for plan cards", () => {
    const stats = getCyclePlanStats(mockCyclePlans[0], "2026-07-10");

    expect(stats.totalEntries).toBe(3);
    expect(stats.todayHits).toBe(1);
    expect(stats.pendingEntries).toBe(3);
  });
});
