/**
 * 模块用途：定义手动提交合同，并为浏览器 Demo 执行纯领域变更。
 * 模块边界：不访问 React、IPC 或持久化；正式桌面变更由 Plan API 执行。
 */
import {
  CYCLE_PLAN_SCHEMA_VERSION,
  type CyclePlan,
  type CyclePlanEntry,
  type PlanContentBlock,
  type Todo
} from "../../shared/appDomainTypes";
import type { AppMutationOperation, AppMutationSource } from "../../shared/appMutationTypes";
import type {
  ContentBlockDraft,
  CyclePlanEntryCreateDraft
} from "../../shared/aiMutationTypes";
import type { AppMutationSnapshot } from "./appMutationGateway";

export type ManualMutationHandler = (
  summary: string,
  operations: AppMutationOperation[]
) => Promise<boolean>;

interface ApplyContext {
  now: string;
  source: AppMutationSource;
  idFactory(prefix: string): string;
}

type TodoOperation = Extract<AppMutationOperation, {
  type: "todo.create" | "todo.update" | "todo.complete" | "todo.reopen" | "todo.delete";
}>;

export function applyBrowserMutationOperation(
  snapshot: AppMutationSnapshot,
  operation: AppMutationOperation,
  context: ApplyContext
): AppMutationSnapshot {
  return {
    todos: applyTodo(snapshot.todos, operation, context),
    cyclePlans: applyPlan(snapshot.cyclePlans, operation, context)
  };
}

function applyTodo(
  todos: Todo[],
  operation: AppMutationOperation,
  context: ApplyContext
): Todo[] {
  if (!isTodoOperation(operation)) return todos;
  const syncStatus = context.source.type === "manual" ? "local" : "queued";
  if (operation.type === "todo.create") {
    return [{
      id: context.idFactory("todo"),
      ...operation.draft,
      status: "pending",
      syncStatus,
      source: context.source,
      createdAt: context.now,
      updatedAt: context.now,
      snoozeCount: 0
    }, ...todos];
  }
  if (operation.type === "todo.delete") {
    return todos.filter((todo) => todo.id !== operation.targetId);
  }
  return todos.map((todo) => {
    if (todo.id !== operation.targetId) return todo;
    if (operation.type === "todo.update") {
      return { ...todo, ...defined(operation.patch), syncStatus, updatedAt: context.now };
    }
    if (operation.type === "todo.complete") {
      return {
        ...todo, status: "completed", completedAt: context.now, syncStatus,
        updatedAt: context.now
      };
    }
    return {
      ...todo, status: "pending", completedAt: undefined, syncStatus,
      updatedAt: context.now
    };
  });
}

function isTodoOperation(operation: AppMutationOperation): operation is TodoOperation {
  return operation.type === "todo.create"
    || operation.type === "todo.update"
    || operation.type === "todo.complete"
    || operation.type === "todo.reopen"
    || operation.type === "todo.delete";
}

function applyPlan(
  plans: CyclePlan[],
  operation: AppMutationOperation,
  context: ApplyContext
): CyclePlan[] {
  if (!operation.type.startsWith("cyclePlan.")) return plans;
  if (operation.type === "cyclePlan.create") {
    const planId = context.idFactory("plan");
    const { entries = [], ...draft } = operation.draft;
    return [{
      schemaVersion: CYCLE_PLAN_SCHEMA_VERSION,
      id: planId,
      ...draft,
      status: operation.draft.status ?? "active",
      source: context.source,
      entries: entries.map((entry) => buildEntry(entry, planId, context)),
      createdAt: context.now,
      updatedAt: context.now
    }, ...plans];
  }
  if (operation.type === "cyclePlan.delete") {
    return plans.filter((plan) => plan.id !== operation.targetId);
  }
  if (operation.type === "cyclePlan.update" || operation.type === "cyclePlan.setStatus") {
    return plans.map((plan) => plan.id !== operation.targetId ? plan : {
      ...plan,
      ...(operation.type === "cyclePlan.update"
        ? defined(operation.patch)
        : { status: operation.status }),
      updatedAt: context.now
    });
  }
  if (operation.type === "cyclePlan.entry.create") {
    return plans.map((plan) => plan.id !== operation.planId ? plan : {
      ...plan,
      entries: [...plan.entries, buildEntry(operation.draft, plan.id, context)],
      updatedAt: context.now
    });
  }
  return plans.map((plan) => applyEntry(plan, operation, context));
}

function applyEntry(
  plan: CyclePlan,
  operation: AppMutationOperation,
  context: ApplyContext
): CyclePlan {
  if (!("targetId" in operation)
    || !operation.type.startsWith("cyclePlan.entry.")
    || !plan.entries.some((entry) => entry.id === operation.targetId)) return plan;
  if (operation.type === "cyclePlan.entry.delete") {
    return {
      ...plan,
      entries: plan.entries.filter((entry) => entry.id !== operation.targetId),
      updatedAt: context.now
    };
  }
  const entries = plan.entries.map((entry) =>
    entry.id === operation.targetId ? changeEntry(entry, operation, context) : entry
  );
  return { ...plan, entries, updatedAt: context.now };
}

function changeEntry(
  entry: CyclePlanEntry,
  operation: AppMutationOperation,
  context: ApplyContext
): CyclePlanEntry {
  if (operation.type === "cyclePlan.entry.update") {
    const patch = defined(operation.patch);
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
    return { ...entry, status: "completed", completedAt: context.now, updatedAt: context.now };
  }
  if (operation.type === "cyclePlan.entry.skip") {
    return { ...entry, status: "skipped", completedAt: undefined, updatedAt: context.now };
  }
  return { ...entry, status: "pending", completedAt: undefined, updatedAt: context.now };
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

function buildBlocks(blocks: ContentBlockDraft[], context: ApplyContext): PlanContentBlock[] {
  return blocks.map((block) => ({
    schemaVersion: CYCLE_PLAN_SCHEMA_VERSION,
    id: context.idFactory("block"),
    ...block
  }));
}

function defined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined)
  ) as Partial<T>;
}
