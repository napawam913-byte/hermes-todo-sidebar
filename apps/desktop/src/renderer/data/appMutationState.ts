/**
 * 模块用途：维护已持久化 UI 快照，并校验浏览器预览变更的目标版本。
 * 模块边界：不访问 IPC、localStorage 或 React；领域变更委托给纯函数执行。
 */
import type { AiMutationOperation } from "../../shared/aiMutationTypes";
import type { AppMutationBatch } from "../../shared/appMutationTypes";
import type { AppMutationSnapshot } from "./appMutationGateway";
import { applyBrowserMutationOperation } from "./manualMutation";

export interface AppMutationUiState {
  snapshot: AppMutationSnapshot;
  busy: boolean;
  error: string | null;
}

export type AppMutationUiEvent =
  | { type: "mutation.started" }
  | { type: "mutation.succeeded"; snapshot: AppMutationSnapshot }
  | { type: "mutation.failed"; message: string }
  | { type: "snapshot.hydrated"; snapshot: AppMutationSnapshot }
  | { type: "error.cleared" };

export function createMutationUiState(snapshot: AppMutationSnapshot): AppMutationUiState {
  return { snapshot: structuredClone(snapshot), busy: false, error: null };
}

export function reduceMutationUiState(
  state: AppMutationUiState,
  event: AppMutationUiEvent
): AppMutationUiState {
  if (event.type === "mutation.started") return { ...state, busy: true, error: null };
  if (event.type === "mutation.succeeded") {
    return { snapshot: structuredClone(event.snapshot), busy: false, error: null };
  }
  if (event.type === "mutation.failed") return { ...state, busy: false, error: event.message };
  if (event.type === "snapshot.hydrated") {
    return { snapshot: structuredClone(event.snapshot), busy: false, error: null };
  }
  return { ...state, error: null };
}

export function applyBrowserMutationBatch(
  snapshot: AppMutationSnapshot,
  batch: AppMutationBatch,
  context: { now: string; idFactory(prefix: string): string }
): AppMutationSnapshot {
  validateTargets(snapshot, batch.operations);
  return batch.operations.reduce(
    (current, operation) => applyBrowserMutationOperation(
      current,
      operation,
      { ...context, source: batch.source }
    ),
    structuredClone(snapshot)
  );
}

function validateTargets(
  snapshot: AppMutationSnapshot,
  operations: AiMutationOperation[]
): void {
  const todos = new Map(snapshot.todos.map((item) => [item.id, item]));
  const plans = new Map(snapshot.cyclePlans.map((item) => [item.id, item]));
  const entries = new Map(snapshot.cyclePlans.flatMap((plan) =>
    plan.entries.map((entry) => [entry.id, entry] as const)
  ));
  for (const operation of operations) {
    if (operation.type === "todo.create" || operation.type === "cyclePlan.create") continue;
    if (operation.type === "cyclePlan.entry.create") {
      assertVersion(plans.get(operation.planId), operation.expectedUpdatedAt, "周期计划");
    } else if (operation.type.startsWith("todo.")) {
      assertVersion(todos.get(operation.targetId), operation.expectedUpdatedAt, "待办");
    } else if (operation.type.startsWith("cyclePlan.entry.")) {
      assertVersion(entries.get(operation.targetId), operation.expectedUpdatedAt, "计划条目");
    } else {
      assertVersion(plans.get(operation.targetId), operation.expectedUpdatedAt, "周期计划");
    }
  }
}

function assertVersion(
  target: { updatedAt: string } | undefined,
  expected: string | undefined,
  label: string
): void {
  if (!target) throw new Error(`${label}不存在或已被删除`);
  if (!expected || target.updatedAt !== expected) {
    throw new Error(`${label}版本冲突，请刷新后重试`);
  }
}
