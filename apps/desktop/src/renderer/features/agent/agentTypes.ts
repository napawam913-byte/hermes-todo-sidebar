/**
 * 模块用途：定义桌面端 Agent 扩展层的意图、上下文、建议和动作类型。
 * 模块边界：只放共享契约，不调用模型、不访问 Hermes、不修改待办。
 */
import type { TodoStatus } from "../todos/types";
import type { CyclePlan } from "../cyclePlans/cyclePlanTypes";

export type AgentIntentSource = "desktop-sidebar";
export type AgentClientStatus = "disabled" | "ready" | "failed";
export type AgentConfidence = "low" | "medium" | "high";

export type AgentActionType =
  | "todo.create"
  | "todo.complete"
  | "todo.snooze"
  | "plan.today"
  | "cyclePlan.createDraft";

export interface AgentTodoContext {
  id: string;
  title: string;
  status: TodoStatus;
  remindAt?: string;
  snoozeCount: number;
}

export interface AgentContextSummary {
  pendingCount: number;
  overdueCount: number;
  todayCount: number;
  completedCount: number;
}

export interface AgentContextSnapshot {
  capturedAt: string;
  todos: AgentTodoContext[];
  summary: AgentContextSummary;
}

export interface AgentIntent {
  intentId: string;
  text: string;
  createdAt: string;
  source: AgentIntentSource;
  context?: AgentContextSnapshot;
}

interface AgentActionBase {
  actionId: string;
  reason?: string;
}

export interface CyclePlanDraftAction extends AgentActionBase {
  type: "cyclePlan.createDraft";
  input: { plan: CyclePlan };
}

export interface GenericAgentAction extends AgentActionBase {
  type: Exclude<AgentActionType, "cyclePlan.createDraft">;
  input: Record<string, unknown>;
}

export type AgentAction = GenericAgentAction | CyclePlanDraftAction;

export interface AgentProposal {
  proposalId: string;
  title: string;
  summary: string;
  actions: AgentAction[];
  confidence: AgentConfidence;
  createdAt: string;
}

export interface AgentProposalResult {
  status: AgentClientStatus;
  proposals: AgentProposal[];
  message?: string;
}
