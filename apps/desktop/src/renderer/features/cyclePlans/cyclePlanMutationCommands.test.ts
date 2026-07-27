/**
 * 模块用途：验证周期计划表单会生成计划和条目级通用变更操作。
 * 模块边界：只比较纯命令，不访问仓储或 React 状态。
 */
import { describe, expect, it } from "vitest";
import { mockCyclePlans } from "./mockCyclePlans";
import {
  buildDeletePlanOperation,
  buildEntryStatusOperation,
  buildSavePlanOperations,
  buildSetPlanStatusOperation
} from "./cyclePlanMutationCommands";

describe("cyclePlanMutationCommands", () => {
  it("creates one plan operation with all new entries", () => {
    const plan = { ...mockCyclePlans[0], id: "new", source: { type: "manual" as const } };
    const operations = buildSavePlanOperations(plan);
    expect(operations).toHaveLength(1);
    expect(operations[0]).toMatchObject({ type: "cyclePlan.create" });
    if (operations[0].type !== "cyclePlan.create") throw new Error("操作类型错误");
    expect(operations[0].draft.title).toBe(plan.title);
    expect(operations[0].draft.entries).toHaveLength(3);
    expect(operations[0].draft.entries?.[0]).toMatchObject({ title: plan.entries[0].title });
  });

  it("updates a plan and diffs existing, new and removed entries", () => {
    const existing = mockCyclePlans[0];
    const kept = { ...existing.entries[0], title: "已修改" };
    const added = { ...existing.entries[1], id: "entry_new", title: "新增条目" };
    const next = {
      ...existing,
      title: "新版计划",
      entries: [kept, existing.entries[1], added]
    };
    const operations = buildSavePlanOperations(next, existing);

    expect(operations.map((item) => item.type)).toEqual([
      "cyclePlan.update",
      "cyclePlan.entry.update",
      "cyclePlan.entry.create",
      "cyclePlan.entry.delete"
    ]);
  });

  it("builds plan and entry status commands", () => {
    const plan = mockCyclePlans[0];
    const entry = plan.entries[0];
    expect(buildSetPlanStatusOperation(plan, "paused")).toMatchObject({
      type: "cyclePlan.setStatus", expectedUpdatedAt: plan.updatedAt
    });
    expect(buildDeletePlanOperation(plan)).toMatchObject({ type: "cyclePlan.delete" });
    expect(buildEntryStatusOperation(entry, "skip")).toMatchObject({
      type: "cyclePlan.entry.skip", expectedUpdatedAt: entry.updatedAt
    });
  });
});
