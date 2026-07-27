/**
 * 模块用途：验证 AI 会话中的自然语言回复与未发送输入草稿状态。
 * 模块边界：只测试 reducer，不调用 React、IPC 或模型网络。
 */
import { describe, expect, it } from "vitest";
import { createAiPlannerState, reduceAiPlannerState } from "./aiPlannerState";

describe("AI planner conversation state", () => {
  it("初始存在受控输入草稿，并可独立更新", () => {
    const initial = createAiPlannerState();
    expect(initial.composerDraft).toBe("");

    const changed = reduceAiPlannerState(initial, {
      type: "composer.changed",
      message: "继续讨论训练频率"
    });
    expect(changed.composerDraft).toBe("继续讨论训练频率");
  });

  it("自然语言模型回复不会创建或清除提案", () => {
    const next = reduceAiPlannerState(createAiPlannerState(), {
      type: "conversation.assistant-added",
      message: "你希望每周训练几次？"
    });

    expect(next.screen).toBe("conversation");
    expect(next.proposal).toBeNull();
    expect(next.conversation.at(-1)).toEqual({
      role: "assistant",
      content: "你希望每周训练几次？"
    });
  });

  it("页面切换保留草稿，发送和新流程才清空", () => {
    const drafted = reduceAiPlannerState(createAiPlannerState(), {
      type: "composer.changed",
      message: "每周训练三次"
    });
    const switched = reduceAiPlannerState(drafted, {
      type: "screen.open",
      screen: "proposal"
    });
    expect(switched.composerDraft).toBe("每周训练三次");

    const sent = reduceAiPlannerState(switched, {
      type: "conversation.user-added",
      message: "每周训练三次"
    });
    expect(sent.composerDraft).toBe("");

    const restarted = reduceAiPlannerState(drafted, {
      type: "flow.started",
      screen: "conversation"
    });
    expect(restarted.composerDraft).toBe("");
  });
});
