/**
 * 模块用途：验证 Hermes 最终文本会被稳定区分为普通聊天或严格变更提案。
 * 模块边界：不调用模型、不补充 ID，也不执行提案。
 */
import { describe, expect, it } from "vitest";
import { classifyAiAssistantResponse } from "./aiResponseClassifier.js";

describe("classifyAiAssistantResponse", () => {
  it("keeps normal assistant text as a chat message", () => {
    expect(classifyAiAssistantResponse("新手可以先从每周三练开始。"))
      .toEqual({ status: "message", message: "新手可以先从每周三练开始。" });
  });

  it("recognizes an exact cycle plan proposal", () => {
    const result = classifyAiAssistantResponse(JSON.stringify({
      schemaVersion: 1,
      summary: "创建一周健身计划",
      operations: [{
        type: "cyclePlan.create",
        draft: {
          title: "一周健身计划",
          topic: "健身",
          description: "每周三练",
          entries: []
        }
      }]
    }));

    expect(result).toMatchObject({
      status: "proposal",
      proposal: { summary: "创建一周健身计划" }
    });
  });

  it("rejects proposal-like JSON instead of displaying it as chat", () => {
    expect(() => classifyAiAssistantResponse(JSON.stringify({
      schemaVersion: 1,
      summary: "损坏提案",
      operations: [{ type: "cyclePlan.unknown" }]
    }))).toThrow("提案格式无效");
  });

  it("rejects malformed proposal-like text", () => {
    expect(() => classifyAiAssistantResponse(
      '{"schemaVersion":1,"summary":"损坏","operations":['
    )).toThrow("提案格式无效");
  });

  it("leaves unrelated JSON as ordinary text", () => {
    const content = '{"answer":"每周三练"}';
    expect(classifyAiAssistantResponse(content)).toEqual({
      status: "message",
      message: content
    });
  });
});
