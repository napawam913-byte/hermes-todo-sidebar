/**
 * 模块用途：定义周期任务 AI 流程的启动上下文与输入框展示文案。
 * 模块边界：不调用模型、不读取计划仓储，也不保存会话。
 */
import type { AiGenerationContext } from "../../../shared/aiMutationTypes";

export type AiPlannerLaunchContext =
  | { type: "cyclePlan.create" }
  | {
      type: "cyclePlan.adjust";
      targetPlanId: string;
      targetPlanTitle: string;
      targetPlanSummary: string;
    };

export interface AiLaunchPresentation {
  heading: string;
  chatTitle: string;
  emptyTitle: string;
  emptyDescription: string;
  placeholder: string;
  suggestions: readonly string[];
  composerSeed: string;
  contextLabel: string;
}

export function getAiLaunchPresentation(
  context: AiPlannerLaunchContext
): AiLaunchPresentation {
  if (context.type === "cyclePlan.create") {
    return {
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
    };
  }
  return {
    heading: `调整「${context.targetPlanTitle}」`,
    chatTitle: "说明调整目标",
    emptyTitle: "你想怎样调整这个计划",
    emptyDescription: "说明需要保留、修改或删除的内容，我会先生成变更提案供你确认。",
    placeholder: "描述要调整的频率、内容或日期",
    suggestions: [
      "把计划调整为每周三次",
      "降低后续条目的执行强度",
      "删除不需要的复盘条目"
    ],
    composerSeed: `请调整周期任务「${context.targetPlanTitle}」：`,
    contextLabel: `${context.targetPlanTitle} · ${context.targetPlanSummary}`
  };
}

export function toAiGenerationContext(
  context: AiPlannerLaunchContext
): AiGenerationContext {
  return context.type === "cyclePlan.create"
    ? { type: "cyclePlan.create" }
    : { type: "cyclePlan.adjust", targetPlanId: context.targetPlanId };
}

export function isSameAiLaunchContext(
  left: AiPlannerLaunchContext,
  right: AiPlannerLaunchContext
): boolean {
  if (left.type !== right.type) return false;
  if (left.type === "cyclePlan.create") return true;
  return right.type === "cyclePlan.adjust" && left.targetPlanId === right.targetPlanId;
}
