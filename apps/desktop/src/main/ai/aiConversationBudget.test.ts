/**
 * 模块用途：验证长对话在字符预算内保留首次目标与最近完整轮次。
 * 模块边界：只测试纯上下文选择，不调用模型、IPC 或本地存储。
 */
import { describe, expect, it } from "vitest";
import {
  AI_CONVERSATION_CHARACTER_BUDGET,
  selectConversationWithinBudget
} from "./aiConversationBudget.js";

describe("selectConversationWithinBudget", () => {
  it("始终保留首次用户目标和预算内的最近完整轮次", () => {
    const conversation = [
      { role: "user" as const, content: "首次目标：制定四周健身计划" },
      { role: "assistant" as const, content: "旧回复".repeat(6_000) },
      { role: "user" as const, content: "旧补充".repeat(6_000) },
      { role: "assistant" as const, content: "最近回复".repeat(1_000) },
      { role: "user" as const, content: "最近要求".repeat(1_000) }
    ];

    const selected = selectConversationWithinBudget(conversation);

    expect(selected[0]).toEqual(conversation[0]);
    expect(selected.at(-2)).toEqual(conversation.at(-2));
    expect(selected.at(-1)).toEqual(conversation.at(-1));
    expect(selected).not.toContain(conversation[1]);
    expect(selected.reduce((sum, turn) => sum + turn.content.length, 0))
      .toBeLessThanOrEqual(AI_CONVERSATION_CHARACTER_BUDGET);
  });

  it("不截断单条消息并保持原有时间顺序", () => {
    const conversation = [
      { role: "user" as const, content: "目标" },
      { role: "assistant" as const, content: "a".repeat(20) },
      { role: "user" as const, content: "b".repeat(20) }
    ];

    expect(selectConversationWithinBudget(conversation, 25)).toEqual([
      conversation[0],
      conversation[2]
    ]);
  });
});
