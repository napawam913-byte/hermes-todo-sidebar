/**
 * 模块用途：为模型提案补充本地生成的提案 ID 和目标版本快照。
 * 模块边界：不修改业务数据，不执行操作，也不接受模型提供的版本字段。
 */
import type { CyclePlanEntry } from "../../shared/appDomainTypes.js";
import type {
  AiMutationOperation,
  AiMutationProposal,
  ModelMutationProposal
} from "../../shared/aiMutationTypes.js";
import type { StoredAppStateV1 } from "../storage/appStateTypes.js";
import { readStoredPlans, readStoredTodos } from "./storedDomainValidation.js";

type VersionedOperation = Exclude<
  AiMutationOperation,
  { type: "todo.create" } | { type: "cyclePlan.create" }
>;

export function enrichAiProposal(
  modelProposal: ModelMutationProposal,
  state: StoredAppStateV1,
  proposalId: string
): AiMutationProposal {
  const todos = new Map(readStoredTodos(state.todos).map((todo) => [todo.id, todo]));
  const plans = new Map(readStoredPlans(state.cyclePlans).map((plan) => [plan.id, plan]));
  const entries = new Map<string, CyclePlanEntry>();
  for (const plan of plans.values()) {
    for (const entry of plan.entries) entries.set(entry.id, entry);
  }
  return {
    ...modelProposal,
    proposalId,
    operations: modelProposal.operations.map((operation) => {
      if (operation.type === "todo.create" || operation.type === "cyclePlan.create") return operation;
      if (operation.type === "cyclePlan.entry.create") {
        const target = plans.get(operation.planId);
        return withVersion(operation, target?.updatedAt, "周期计划", target?.title);
      }
      if (operation.type.startsWith("todo.")) {
        const target = todos.get(operation.targetId);
        return withVersion(operation, target?.updatedAt, "待办", target?.title);
      }
      if (operation.type.startsWith("cyclePlan.entry.")) {
        const target = entries.get(operation.targetId);
        return withVersion(operation, target?.updatedAt, "计划条目", target?.title);
      }
      const target = plans.get(operation.targetId);
      return withVersion(operation, target?.updatedAt, "周期计划", target?.title);
    })
  };
}

function withVersion<T extends VersionedOperation>(
  operation: T,
  updatedAt: string | undefined,
  label: string,
  targetLabel: string | undefined
): T {
  if (!updatedAt) throw new Error(`${label}不存在，无法生成提案`);
  return { ...operation, expectedUpdatedAt: updatedAt, targetLabel } as T;
}
