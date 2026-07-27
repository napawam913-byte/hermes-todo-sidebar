/**
 * 模块用途：在任何修改发生前校验提案目标存在且版本仍与预览时一致。
 * 模块边界：只读初始快照，不生成数据也不执行操作。
 */
import type { CyclePlan, CyclePlanEntry, Todo } from "../../shared/appDomainTypes.js";
import type { AiMutationOperation, AiMutationProposal } from "../../shared/aiMutationTypes.js";
import { AiExecutionError } from "./aiExecutionError.js";

export function validateProposalTargets(
  todos: Todo[],
  plans: CyclePlan[],
  proposal: AiMutationProposal
): void {
  validateMutationTargets(todos, plans, proposal.operations);
}

export function validateMutationTargets(
  todos: Todo[],
  plans: CyclePlan[],
  operations: AiMutationOperation[]
): void {
  const todoMap = new Map(todos.map((todo) => [todo.id, todo]));
  const planMap = new Map(plans.map((plan) => [plan.id, plan]));
  const entryMap = new Map<string, CyclePlanEntry>();
  for (const plan of plans) {
    for (const entry of plan.entries) entryMap.set(entry.id, entry);
  }

  for (const operation of operations) {
    if (operation.type === "todo.create" || operation.type === "cyclePlan.create") continue;
    if (operation.type === "cyclePlan.entry.create") {
      assertVersion(
        planMap.get(operation.planId), operation.expectedUpdatedAt, "周期计划", operation.planId
      );
      continue;
    }
    if (operation.type.startsWith("todo.")) {
      assertVersion(
        todoMap.get(operation.targetId), operation.expectedUpdatedAt, "待办", operation.targetId
      );
      continue;
    }
    if (operation.type.startsWith("cyclePlan.entry.")) {
      assertVersion(
        entryMap.get(operation.targetId), operation.expectedUpdatedAt, "计划条目", operation.targetId
      );
      continue;
    }
    assertVersion(
      planMap.get(operation.targetId), operation.expectedUpdatedAt, "周期计划", operation.targetId
    );
  }
}

function assertVersion(
  target: { updatedAt: string } | undefined,
  expectedUpdatedAt: string | undefined,
  label: string,
  targetId: string
): void {
  if (!target) {
    throw new AiExecutionError("target_missing", `${label}不存在或已被删除`, targetId);
  }
  if (!expectedUpdatedAt || target.updatedAt !== expectedUpdatedAt) {
    throw new AiExecutionError(
      "version_conflict",
      `${label}版本冲突，请刷新后重新生成提案`,
      targetId
    );
  }
}
