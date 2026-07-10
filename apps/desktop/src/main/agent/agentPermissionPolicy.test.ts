/**
 * 模块用途：验证主进程 Agent 权限策略默认保护写操作。
 * 模块边界：只判断权限规则，不执行 IPC 或 Hermes 请求。
 */
import { describe, expect, it } from "vitest";
import { getAgentPermissionDecision } from "./agentPermissionPolicy.js";

describe("getAgentPermissionDecision", () => {
  it("requires confirmation for todo write actions by default", () => {
    expect(getAgentPermissionDecision({ type: "todo.create" })).toEqual({
      allowed: true,
      requiresConfirmation: true,
      reason: "Agent 写入待办前必须由用户确认。"
    });
  });

  it("allows planning-only actions without write confirmation", () => {
    expect(getAgentPermissionDecision({ type: "plan.today" })).toEqual({
      allowed: true,
      requiresConfirmation: false,
      reason: "Agent 只生成建议，不修改本地待办。"
    });
  });

  it("requires confirmation before accepting a cycle plan draft", () => {
    expect(getAgentPermissionDecision({ type: "cyclePlan.createDraft" })).toEqual({
      allowed: true,
      requiresConfirmation: true,
      reason: "Agent 创建周期计划草稿前必须由用户确认。"
    });
  });

  it("rejects unknown actions before they reach the renderer", () => {
    expect(getAgentPermissionDecision({ type: "system.delete-all" })).toEqual({
      allowed: false,
      requiresConfirmation: true,
      reason: "未知 Agent 动作不允许执行。"
    });
  });
});
