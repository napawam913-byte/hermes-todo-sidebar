/**
 * 模块用途：维护 Agent 可建议动作的白名单和前端确认策略。
 * 模块边界：只定义动作元数据，不执行待办修改，也不调用 Hermes。
 */
import type { AgentAction, AgentActionType } from "./agentTypes";

export interface AgentActionDefinition {
  type: AgentActionType;
  label: string;
  mutatesTodos: boolean;
  requiresConfirmation: boolean;
}

const AGENT_ACTION_DEFINITIONS: Record<AgentActionType, AgentActionDefinition> = {
  "todo.create": {
    type: "todo.create",
    label: "新增待办",
    mutatesTodos: true,
    requiresConfirmation: true
  },
  "todo.complete": {
    type: "todo.complete",
    label: "完成待办",
    mutatesTodos: true,
    requiresConfirmation: true
  },
  "todo.snooze": {
    type: "todo.snooze",
    label: "稍后待办",
    mutatesTodos: true,
    requiresConfirmation: true
  },
  "plan.today": {
    type: "plan.today",
    label: "生成今日计划",
    mutatesTodos: false,
    requiresConfirmation: false
  },
  "cyclePlan.createDraft": {
    type: "cyclePlan.createDraft",
    label: "创建周期计划草稿",
    mutatesTodos: false,
    requiresConfirmation: true
  }
};

export function getAgentActionDefinition(
  actionType: AgentActionType
): AgentActionDefinition | undefined {
  return AGENT_ACTION_DEFINITIONS[actionType];
}

export function isAllowedAgentAction(action: AgentAction): boolean {
  return Boolean(getAgentActionDefinition(action.type));
}

export function requiresUserConfirmation(action: AgentAction): boolean {
  const definition = getAgentActionDefinition(action.type);
  return definition?.requiresConfirmation ?? true;
}
