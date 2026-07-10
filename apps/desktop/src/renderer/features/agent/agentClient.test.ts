/**
 * 模块用途：验证 Agent 客户端禁用态的稳定返回。
 * 模块边界：不联网、不调用 Hermes，只测试占位客户端契约。
 */
import { describe, expect, it } from "vitest";
import { createDisabledAgentClient } from "./agentClient";
import type { AgentIntent } from "./agentTypes";

describe("createDisabledAgentClient", () => {
  it("returns an unavailable result without producing proposals", async () => {
    const client = createDisabledAgentClient();
    const intent: AgentIntent = {
      intentId: "intent_1",
      text: "帮我安排今天的待办",
      createdAt: "2026-07-09T09:00:00.000Z",
      source: "desktop-sidebar"
    };

    const result = await client.requestProposals(intent);

    expect(result).toEqual({
      status: "disabled",
      proposals: [],
      message: "Agent 尚未启用，当前只保留桌面端扩展接口。"
    });
  });
});
