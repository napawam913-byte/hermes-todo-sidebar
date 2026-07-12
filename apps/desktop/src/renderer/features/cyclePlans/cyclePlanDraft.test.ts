/**
 * 模块用途：验证手动计划表单能生成统一 v2 JSON，并在编辑时保留专业内容块。
 * 模块边界：只测试纯数据转换和列表 upsert，不挂载 React 表单。
 */
import { describe, expect, it } from "vitest";
import { mockCyclePlans } from "./mockCyclePlans";
import {
  createCyclePlanDraft,
  saveCyclePlanDraft,
  upsertCyclePlan
} from "./cyclePlanDraft";

function createIdFactory() {
  let index = 0;
  return () => `generated_${index += 1}`;
}

describe("cyclePlanDraft", () => {
  it("creates an active manual plan with generic Markdown content", () => {
    const idFactory = createIdFactory();
    const draft = createCyclePlanDraft({ dateKey: "2026-07-12", idFactory });
    draft.title = "阅读计划";
    draft.topic = "学习";
    draft.description = "完成教程第一章";
    draft.entries[0] = {
      ...draft.entries[0],
      title: "阅读 1.1 小节",
      contentSummary: "阅读并记录三个要点",
      markdown: "- 阅读正文\n- 整理笔记"
    };

    const plan = saveCyclePlanDraft(draft, {
      idFactory,
      now: new Date("2026-07-12T08:00:00.000Z")
    });

    expect(plan).toMatchObject({
      schemaVersion: 2,
      title: "阅读计划",
      topic: "学习",
      status: "active",
      source: { type: "manual" }
    });
    expect(plan.entries[0]).toMatchObject({
      date: "2026-07-12",
      status: "pending",
      contentBlocks: [{
        schemaVersion: 2,
        kind: "generic.note",
        format: "markdown",
        data: { markdown: "- 阅读正文\n- 整理笔记" }
      }]
    });
  });

  it("preserves specialized blocks when editing an existing plan", () => {
    const existing = mockCyclePlans[0];
    const draft = createCyclePlanDraft({
      dateKey: "2026-07-12",
      idFactory: createIdFactory(),
      plan: existing
    });
    draft.title = "更新后的健身计划";
    draft.entries[0].contentSummary = "更新摘要";

    const updated = saveCyclePlanDraft(draft, {
      existingPlan: existing,
      idFactory: createIdFactory(),
      now: new Date("2026-07-12T09:00:00.000Z")
    });

    expect(updated.id).toBe(existing.id);
    expect(updated.entries[0].contentBlocks).toEqual(existing.entries[0].contentBlocks);
    expect(updated.entries[0].contentSummary).toBe("更新摘要");
    expect(upsertCyclePlan([existing], updated)).toEqual([updated]);
  });
});
