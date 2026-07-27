/**
 * 模块用途：限制周期任务创建与调整模式可接受的模型操作范围。
 * 模块边界：只校验提案作用域，不执行操作或修改本地状态。
 */
import type {
  AiGenerationContext,
  ModelMutationProposal
} from "../../shared/aiMutationTypes.js";
import type { StoredAppStateV1 } from "../storage/appStateTypes.js";
import { readStoredPlans } from "./storedDomainValidation.js";

export function assertProposalMatchesGenerationContext(
  proposal: ModelMutationProposal,
  state: StoredAppStateV1,
  context: AiGenerationContext
): void {
  if (context.type === "assistant") {
    if (proposal.operations.some((operation) => operation.type !== "cyclePlan.create")) {
      throw new Error("通用助手只允许创建周期任务");
    }
    return;
  }
  if (context.type === "cyclePlan.create") {
    if (proposal.operations.some((operation) => operation.type !== "cyclePlan.create")) {
      throw new Error("周期任务创建模式只允许创建周期任务");
    }
    return;
  }

  const plans = readStoredPlans(state.cyclePlans);
  const matchingPlans = plans.filter((candidate) => candidate.id === context.targetPlanId);
  if (matchingPlans.length > 1) throw new Error("周期任务数据存在重复 ID，无法安全调整");
  const plan = matchingPlans[0];
  if (!plan) throw new Error("目标周期任务不存在，无法生成调整提案");
  const entryIds = new Set(plan.entries.map((entry) => entry.id));
  const entryIdCounts = new Map<string, number>();
  for (const candidate of plans) {
    for (const entry of candidate.entries) {
      entryIdCounts.set(entry.id, (entryIdCounts.get(entry.id) ?? 0) + 1);
    }
  }
  const outOfScope = proposal.operations.some((operation) => {
    switch (operation.type) {
      case "cyclePlan.entry.create":
        return operation.planId !== plan.id;
      case "cyclePlan.entry.update":
      case "cyclePlan.entry.complete":
      case "cyclePlan.entry.reopen":
      case "cyclePlan.entry.skip":
      case "cyclePlan.entry.delete":
        if ((entryIdCounts.get(operation.targetId) ?? 0) > 1) {
          throw new Error("周期任务数据存在重复 ID，无法安全调整");
        }
        return !entryIds.has(operation.targetId);
      case "cyclePlan.update":
      case "cyclePlan.setStatus":
      case "cyclePlan.delete":
        return operation.targetId !== plan.id;
      default:
        return true;
    }
  });
  if (outOfScope) throw new Error("AI 调整只能修改当前周期任务");
}
