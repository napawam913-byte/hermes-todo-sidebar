/**
 * 模块用途：定义主进程 Agent 动作权限策略，默认保护所有写入型动作。
 * 模块边界：只做权限判断，不执行 IPC、不调用 Hermes、不修改本地待办。
 */
export interface AgentPermissionRequest {
  type: string;
}

export interface AgentPermissionDecision {
  allowed: boolean;
  requiresConfirmation: boolean;
  reason: string;
}

const TODO_WRITE_ACTIONS = new Set(["todo.create", "todo.complete", "todo.snooze"]);
const READ_ONLY_ACTIONS = new Set(["plan.today"]);
const PLAN_DRAFT_ACTIONS = new Set(["cyclePlan.createDraft"]);

export function getAgentPermissionDecision(
  request: AgentPermissionRequest
): AgentPermissionDecision {
  if (TODO_WRITE_ACTIONS.has(request.type)) {
    return {
      allowed: true,
      requiresConfirmation: true,
      reason: "Agent 写入待办前必须由用户确认。"
    };
  }

  if (READ_ONLY_ACTIONS.has(request.type)) {
    return {
      allowed: true,
      requiresConfirmation: false,
      reason: "Agent 只生成建议，不修改本地待办。"
    };
  }

  if (PLAN_DRAFT_ACTIONS.has(request.type)) {
    return {
      allowed: true,
      requiresConfirmation: true,
      reason: "Agent 创建周期计划草稿前必须由用户确认。"
    };
  }

  return {
    allowed: false,
    requiresConfirmation: true,
    reason: "未知 Agent 动作不允许执行。"
  };
}
