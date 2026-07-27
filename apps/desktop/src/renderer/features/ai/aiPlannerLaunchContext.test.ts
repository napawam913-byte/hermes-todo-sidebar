/**
 * 模块用途：验证周期任务 AI 创建与调整入口生成稳定的标题、输入草稿和请求上下文。
 * 模块边界：只测试纯展示数据，不渲染 React 或调用 Electron IPC。
 */
import { describe, expect, it } from "vitest";
import {
  getAiLaunchPresentation,
  isSameAiLaunchContext
} from "./aiPlannerLaunchContext";

describe("AI 周期任务启动上下文", () => {
  it("creates an empty generation prompt for a new cycle plan", () => {
    expect(getAiLaunchPresentation({ type: "cyclePlan.create" })).toEqual({
      heading: "创建周期计划",
      chatTitle: "开始规划",
      emptyTitle: "告诉我你想完成什么",
      emptyDescription: "描述目标、周期和每周安排，信息足够后我会生成可确认的周期任务提案。",
      placeholder: "描述你的目标、周期和安排要求",
      suggestions: [
        "帮我制定一份 4 周入门健身计划",
        "把一篇教程拆成 7 天学习计划",
        "根据我的目标安排每周任务"
      ],
      composerSeed: "",
      contextLabel: "新建周期任务"
    });
  });

  it("prefills but does not submit the selected plan adjustment", () => {
    expect(getAiLaunchPresentation({
      type: "cyclePlan.adjust",
      targetPlanId: "plan_1",
      targetPlanTitle: "健身计划",
      targetPlanSummary: "4 周训练，共 12 个条目"
    })).toEqual({
      heading: "调整「健身计划」",
      chatTitle: "说明调整目标",
      emptyTitle: "你想怎样调整这个计划",
      emptyDescription: "说明需要保留、修改或删除的内容，我会先生成变更提案供你确认。",
      placeholder: "描述要调整的频率、内容或日期",
      suggestions: [
        "把计划调整为每周三次",
        "降低后续条目的执行强度",
        "删除不需要的复盘条目"
      ],
      composerSeed: "请调整周期任务「健身计划」：",
      contextLabel: "健身计划 · 4 周训练，共 12 个条目"
    });
  });

  it("treats the same creation flow or target plan as the same session context", () => {
    expect(isSameAiLaunchContext(
      { type: "cyclePlan.create" },
      { type: "cyclePlan.create" }
    )).toBe(true);
    expect(isSameAiLaunchContext(
      {
        type: "cyclePlan.adjust",
        targetPlanId: "plan_1",
        targetPlanTitle: "旧标题",
        targetPlanSummary: "旧摘要"
      },
      {
        type: "cyclePlan.adjust",
        targetPlanId: "plan_1",
        targetPlanTitle: "新标题",
        targetPlanSummary: "新摘要"
      }
    )).toBe(true);
    expect(isSameAiLaunchContext(
      { type: "cyclePlan.create" },
      {
        type: "cyclePlan.adjust",
        targetPlanId: "plan_1",
        targetPlanTitle: "健身计划",
        targetPlanSummary: "7 个条目"
      }
    )).toBe(false);
  });
});
