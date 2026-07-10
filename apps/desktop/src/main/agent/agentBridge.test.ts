/**
 * 模块用途：验证主进程 Agent 桥接禁用态不会访问 Hermes。
 * 模块边界：只测试桥接接口占位，不注册真实 IPC。
 */
import { describe, expect, it } from "vitest";
import { createDisabledAgentBridge } from "./agentBridge.js";

describe("createDisabledAgentBridge", () => {
  it("returns disabled status for proposal requests", async () => {
    const bridge = createDisabledAgentBridge();

    await expect(bridge.requestProposals({
      intentId: "intent_1",
      text: "帮我安排今天",
      createdAt: "2026-07-09T09:00:00.000Z",
      source: "desktop-sidebar"
    })).resolves.toEqual({
      status: "disabled",
      proposals: [],
      message: "Agent 主进程桥接尚未连接 Hermes。"
    });
  });
});
