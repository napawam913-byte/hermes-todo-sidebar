/**
 * 模块用途：在克隆快照上编排全部 AI 操作，得到可一次保存的新状态。
 * 模块边界：不直接持久化；调用者负责事务队列和最终保存。
 */
import type { AiMutationProposal } from "../../shared/aiMutationTypes.js";
import type { StoredAppStateV1 } from "../storage/appStateTypes.js";
import { applyCyclePlanMutation } from "./applyCyclePlanMutation.js";
import { applyTodoMutation } from "./applyTodoMutation.js";
import { validateProposalTargets } from "./aiTargetValidation.js";
import { readStoredPlans, readStoredTodos } from "./storedDomainValidation.js";

export interface MutationApplyOptions {
  now: Date;
  idFactory(prefix: string): string;
}

export function applyAiMutationProposal(
  state: StoredAppStateV1,
  proposal: AiMutationProposal,
  options: MutationApplyOptions
): StoredAppStateV1 {
  let todos = readStoredTodos(state.todos);
  let cyclePlans = readStoredPlans(state.cyclePlans);
  validateProposalTargets(todos, cyclePlans, proposal);
  const context = {
    now: options.now.toISOString(),
    source: { type: "ai_draft" as const, proposalId: proposal.proposalId },
    idFactory: options.idFactory
  };
  for (const operation of proposal.operations) {
    todos = applyTodoMutation(todos, operation, context);
    cyclePlans = applyCyclePlanMutation(cyclePlans, operation, context);
  }
  return { ...state, todos, cyclePlans };
}
