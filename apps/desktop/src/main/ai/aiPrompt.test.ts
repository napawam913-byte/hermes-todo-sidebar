/**
 * 模块用途：验证模型上下文使用 Windows 本地日期，并且不包含模型密钥。
 * 模块边界：只检查消息构造，不调用网络或读取真实配置。
 */
import { describe, expect, it } from "vitest";
import { createEmptyAppState } from "../storage/appStateTypes.js";
import { AI_CONVERSATION_CHARACTER_BUDGET } from "./aiConversationBudget.js";
import { buildAiMessages } from "./aiPrompt.js";

const updatedAt = "2026-07-15T08:00:00.000Z";

function createPrivateState() {
  return {
    ...createEmptyAppState(),
    todos: [{
      id: "todo_private", title: "私密待办", date: "2026-07-15", status: "pending" as const,
      syncStatus: "local" as const, source: { type: "manual" as const },
      createdAt: updatedAt, updatedAt, snoozeCount: 0
    }],
    cyclePlans: ["plan_target", "plan_private"].map((id) => ({
      schemaVersion: 2 as const, id, title: id, topic: "测试", description: "私密内容",
      status: "active" as const, source: { type: "manual" as const },
      createdAt: updatedAt, updatedAt, entries: []
    }))
  };
}

describe("buildAiMessages", () => {
  it("uses the supplied local calendar date without sending the full state", () => {
    const messages = buildAiMessages(
      createEmptyAppState(),
      {
        message: "生成健身周期任务",
        conversation: [],
        context: { type: "cyclePlan.create" }
      },
      new Date(2026, 6, 15, 1, 30)
    );

    expect(messages[1].content).toContain('"currentDate":"2026-07-15"');
    expect(messages[0].content).toContain("只允许返回 cyclePlan.create");
    expect(messages[0].content).toContain('"schemaVersion":1');
    expect(messages[0].content).toContain("不要使用 version");
    expect(JSON.stringify(messages)).not.toContain("apiKey");
  });

  it("does not send local todos or plans in general assistant mode", () => {
    const messages = buildAiMessages(
      createPrivateState(),
      {
        message: "聊聊健身",
        conversation: [],
        context: { type: "assistant" }
      },
      new Date(2026, 6, 15, 1, 30)
    );
    const serialized = JSON.stringify(messages);

    expect(messages[1].content).toContain('"currentDate":"2026-07-15"');
    expect(serialized).not.toContain("todo_private");
    expect(serialized).not.toContain("plan_private");
    expect(messages[0].content).toContain("普通聊天");
  });

  it("pins adjustment prompts to only the selected cycle plan", () => {
    const messages = buildAiMessages(
      createPrivateState(),
      {
        message: "把训练改成三天",
        conversation: [],
        context: { type: "cyclePlan.adjust", targetPlanId: "plan_target" }
      }
    );
    const serialized = JSON.stringify(messages);

    expect(serialized).toContain("plan_target");
    expect(serialized).not.toContain("plan_private");
    expect(serialized).not.toContain("todo_private");
    expect(messages[0].content).toContain("不能修改其他周期任务");
  });

  it("keeps the first goal and recent complete turns within the context budget", () => {
    const conversation = [
      { role: "user" as const, content: "首次目标：四周健身计划" },
      ...Array.from({ length: 18 }, (_, index) => ({
        role: index % 2 === 0 ? "assistant" as const : "user" as const,
        content: `旧消息${index}`.repeat(1_000)
      })),
      { role: "assistant" as const, content: "最近回复".repeat(500) }
    ];
    const messages = buildAiMessages(createEmptyAppState(), {
      message: "继续完善",
      conversation,
      context: { type: "cyclePlan.create" }
    });
    const selected = messages.slice(2, -1);

    expect(selected[0].content).toBe(conversation[0].content);
    expect(selected.at(-1)?.content).toBe(conversation.at(-1)?.content);
    expect(selected.reduce((sum, message) => sum + message.content.length, 0))
      .toBeLessThanOrEqual(AI_CONVERSATION_CHARACTER_BUDGET);
    expect(messages.at(-1)?.content).toBe("继续完善");
  });
});
