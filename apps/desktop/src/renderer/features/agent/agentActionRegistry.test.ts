/**
 * 模块用途：验证 Agent 建议动作白名单和确认策略。
 * 模块边界：只判断动作契约，不真正修改待办。
 */
import { describe, expect, it } from "vitest";
import {
  getAgentActionDefinition,
  isAllowedAgentAction,
  requiresUserConfirmation
} from "./agentActionRegistry";
import type { AgentAction } from "./agentTypes";
import { mockCyclePlans } from "../cyclePlans/mockCyclePlans";

describe("agentActionRegistry", () => {
  it("allows only known Agent action types", () => {
    const allowedAction: AgentAction = {
      actionId: "action_1",
      type: "todo.create",
      input: { title: "写 Agent 扩展文档" }
    };
    const unknownAction = {
      actionId: "action_2",
      type: "system.delete-all",
      input: {}
    } as unknown as AgentAction;

    expect(isAllowedAgentAction(allowedAction)).toBe(true);
    expect(isAllowedAgentAction(unknownAction)).toBe(false);
  });

  it("marks todo write actions as requiring user confirmation", () => {
    expect(requiresUserConfirmation({
      actionId: "action_create",
      type: "todo.create",
      input: { title: "新增待办" }
    })).toBe(true);
    expect(requiresUserConfirmation({
      actionId: "action_complete",
      type: "todo.complete",
      input: { todoId: "todo_1" }
    })).toBe(true);
    expect(requiresUserConfirmation({
      actionId: "action_plan",
      type: "plan.today",
      input: {}
    })).toBe(false);
  });

  it("exposes action metadata for future UI and Hermes handoff", () => {
    expect(getAgentActionDefinition("todo.snooze")).toEqual({
      type: "todo.snooze",
      label: "稍后待办",
      mutatesTodos: true,
      requiresConfirmation: true
    });
  });

  it("allows Hermes to propose a cycle plan draft but requires confirmation", () => {
    const action: AgentAction = {
      actionId: "action_cycle_plan",
      type: "cyclePlan.createDraft",
      input: { plan: mockCyclePlans[0] }
    };

    expect(isAllowedAgentAction(action)).toBe(true);
    expect(requiresUserConfirmation(action)).toBe(true);
    expect(getAgentActionDefinition(action.type)).toMatchObject({
      label: "创建周期计划草稿",
      mutatesTodos: false,
      requiresConfirmation: true
    });
  });
});
