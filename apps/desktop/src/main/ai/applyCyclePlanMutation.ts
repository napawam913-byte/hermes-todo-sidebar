/**
 * 模块用途：执行周期计划和计划条目的新增、修改、状态与删除操作。
 * 模块边界：假定目标和版本已统一校验，不访问文件或普通待办。
 */
import {
  CYCLE_PLAN_SCHEMA_VERSION,
  type CyclePlan,
  type CyclePlanEntry,
  type PlanContentBlock
} from "../../shared/appDomainTypes.js";
import type { AppMutationSource } from "../../shared/appMutationTypes.js";
import type {
  AiMutationOperation,
  ContentBlockDraft,
  CyclePlanEntryCreateDraft
} from "../../shared/aiMutationTypes.js";

interface ApplyContext {
  now: string;
  source: AppMutationSource;
  idFactory(prefix: string): string;
}

export function applyCyclePlanMutation(
  plans: CyclePlan[],
  operation: AiMutationOperation,
  context: ApplyContext
): CyclePlan[] {
  if (!operation.type.startsWith("cyclePlan.")) return plans;
  if (operation.type === "cyclePlan.create") {
    const { entries: entryDrafts = [], ...planDraft } = operation.draft;
    const planId = context.idFactory("plan");
    const plan: CyclePlan = {
      schemaVersion: CYCLE_PLAN_SCHEMA_VERSION,
      id: planId,
      ...planDraft,
      status: operation.draft.status ?? "active",
      source: context.source,
      entries: entryDrafts.map((draft) => buildEntry(draft, planId, context)),
      createdAt: context.now,
      updatedAt: context.now
    };
    return [plan, ...plans];
  }
  if (operation.type === "cyclePlan.delete") {
    return plans.filter((plan) => plan.id !== operation.targetId);
  }
  if (operation.type === "cyclePlan.update" || operation.type === "cyclePlan.setStatus") {
    return plans.map((plan) => {
      if (plan.id !== operation.targetId) return plan;
      const change = operation.type === "cyclePlan.update"
        ? withoutUndefined(operation.patch)
        : { status: operation.status };
      return { ...plan, ...change, updatedAt: context.now };
    });
  }
  if (operation.type === "cyclePlan.entry.create") {
    return plans.map((plan) => {
      if (plan.id !== operation.planId) return plan;
      const entry: CyclePlanEntry = {
        schemaVersion: CYCLE_PLAN_SCHEMA_VERSION,
        id: context.idFactory("entry"),
        planId: plan.id,
        ...operation.draft,
        contentBlocks: buildBlocks(operation.draft.contentBlocks, context),
        status: "pending",
        source: context.source,
        createdAt: context.now,
        updatedAt: context.now
      };
      return { ...plan, entries: [...plan.entries, entry], updatedAt: context.now };
    });
  }
  return plans.map((plan) => applyEntryOperation(plan, operation, context));
}

function applyEntryOperation(
  plan: CyclePlan,
  operation: AiMutationOperation,
  context: ApplyContext
): CyclePlan {
  if (!("targetId" in operation)) return plan;
  if (!plan.entries.some((entry) => entry.id === operation.targetId)) return plan;
  if (operation.type === "cyclePlan.entry.delete") {
    return {
      ...plan,
      entries: plan.entries.filter((entry) => entry.id !== operation.targetId),
      updatedAt: context.now
    };
  }
  const entries = plan.entries.map((entry) => {
    if (entry.id !== operation.targetId) return entry;
    if (operation.type === "cyclePlan.entry.update") {
      const patch = withoutUndefined(operation.patch);
      return {
        ...entry,
        ...patch,
        contentBlocks: patch.contentBlocks
          ? buildBlocks(patch.contentBlocks, context)
          : entry.contentBlocks,
        updatedAt: context.now
      };
    }
    if (operation.type === "cyclePlan.entry.complete") {
      return { ...entry, status: "completed" as const, completedAt: context.now, updatedAt: context.now };
    }
    if (operation.type === "cyclePlan.entry.skip") {
      return { ...entry, status: "skipped" as const, completedAt: undefined, updatedAt: context.now };
    }
    return { ...entry, status: "pending" as const, completedAt: undefined, updatedAt: context.now };
  });
  return { ...plan, entries, updatedAt: context.now };
}

function buildBlocks(blocks: ContentBlockDraft[], context: ApplyContext): PlanContentBlock[] {
  return blocks.map((block) => ({
    schemaVersion: CYCLE_PLAN_SCHEMA_VERSION,
    id: context.idFactory("block"),
    ...block
  }));
}

function buildEntry(
  draft: CyclePlanEntryCreateDraft,
  planId: string,
  context: ApplyContext
): CyclePlanEntry {
  return {
    schemaVersion: CYCLE_PLAN_SCHEMA_VERSION,
    id: context.idFactory("entry"),
    planId,
    ...draft,
    contentBlocks: buildBlocks(draft.contentBlocks, context),
    status: "pending",
    source: context.source,
    createdAt: context.now,
    updatedAt: context.now
  };
}

function withoutUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as Partial<T>;
}
