/**
 * 模块用途：把周期计划编辑结果和状态按钮转换为通用变更操作。
 * 模块边界：只做计划/条目差异计算，不保存数据或管理 UI。
 */
import type {
  AppMutationOperation
} from "../../../shared/appMutationTypes";
import type {
  ContentBlockDraft,
  CyclePlanMutationStatus
} from "../../../shared/aiMutationTypes";
import type { CyclePlan, CyclePlanEntry, PlanContentBlock } from "./cyclePlanTypes";

// [待删除-2026-07-15]
// 原用途：把手动编辑表单的完整计划差异转换成新增、修改和删除操作。
// 替代方案：周期任务内容由 AI 提案直接返回标准 AppMutationOperation。
// 删除条件：用户确认 0.1.3-test.6 后删除此函数及其专用测试和私有转换函数。
export function buildSavePlanOperations(
  next: CyclePlan,
  existing?: CyclePlan
): AppMutationOperation[] {
  if (!existing) {
    return [{
      type: "cyclePlan.create",
      draft: {
        title: next.title,
        topic: next.topic,
        description: next.description,
        status: next.status,
        entries: next.entries.map(toEntryDraft)
      }
    }];
  }

  const operations: AppMutationOperation[] = [{
    type: "cyclePlan.update",
    targetId: existing.id,
    expectedUpdatedAt: existing.updatedAt,
    targetLabel: existing.title,
    patch: {
      title: next.title,
      topic: next.topic,
      description: next.description
    }
  }];
  const existingEntries = new Map(existing.entries.map((entry) => [entry.id, entry]));
  for (const entry of next.entries) {
    const previous = existingEntries.get(entry.id);
    if (!previous) {
      operations.push({
        type: "cyclePlan.entry.create",
        planId: existing.id,
        expectedUpdatedAt: existing.updatedAt,
        targetLabel: entry.title,
        draft: toEntryDraft(entry)
      });
    } else if (entryChanged(entry, previous)) {
      operations.push({
        type: "cyclePlan.entry.update",
        targetId: previous.id,
        expectedUpdatedAt: previous.updatedAt,
        targetLabel: previous.title,
        patch: toEntryDraft(entry)
      });
    }
  }
  for (const entry of existing.entries) {
    if (!next.entries.some((candidate) => candidate.id === entry.id)) {
      operations.push(buildEntryStatusOperation(entry, "delete"));
    }
  }
  return operations;
}

export function buildSetPlanStatusOperation(
  plan: CyclePlan,
  status: CyclePlanMutationStatus
): AppMutationOperation {
  return {
    type: "cyclePlan.setStatus",
    targetId: plan.id,
    expectedUpdatedAt: plan.updatedAt,
    targetLabel: plan.title,
    status
  };
}

export function buildDeletePlanOperation(plan: CyclePlan): AppMutationOperation {
  return {
    type: "cyclePlan.delete",
    targetId: plan.id,
    expectedUpdatedAt: plan.updatedAt,
    targetLabel: plan.title
  };
}

export function buildEntryStatusOperation(
  entry: CyclePlanEntry,
  action: "complete" | "reopen" | "skip" | "delete"
): AppMutationOperation {
  return {
    type: `cyclePlan.entry.${action}`,
    targetId: entry.id,
    expectedUpdatedAt: entry.updatedAt,
    targetLabel: entry.title
  } as AppMutationOperation;
}

function toEntryDraft(entry: CyclePlanEntry) {
  return {
    date: entry.date,
    title: entry.title,
    contentSummary: entry.contentSummary,
    contentBlocks: entry.contentBlocks.map(toBlockDraft)
  };
}

function toBlockDraft(block: PlanContentBlock): ContentBlockDraft {
  return { kind: block.kind, title: block.title, format: block.format, data: block.data };
}

function entryChanged(next: CyclePlanEntry, previous: CyclePlanEntry): boolean {
  return JSON.stringify(toEntryDraft(next)) !== JSON.stringify(toEntryDraft(previous));
}
