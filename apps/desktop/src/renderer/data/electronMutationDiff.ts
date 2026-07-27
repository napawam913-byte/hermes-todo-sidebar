/** 模块用途：把 renderer 的完整快照保存转换为 Plan API 白名单变更批次。 */
import type { AppMutationBatch, AppMutationOperation } from "../../shared/appMutationTypes";
import type { CyclePlan, CyclePlanEntry, PlanContentBlock } from "../features/cyclePlans/cyclePlanTypes";
import type { Todo } from "../features/todos/types";

export interface DomainSnapshot { todos: Todo[]; cyclePlans: CyclePlan[]; }
export function createSnapshotMutationBatch(previous: DomainSnapshot, next: DomainSnapshot): AppMutationBatch | null {
  const operations = [...todoOperations(previous.todos, next.todos), ...planOperations(previous.cyclePlans, next.cyclePlans)];
  return operations.length ? { source: { type: "manual" }, summary: "保存桌面数据", operations } : null;
}
function todoOperations(previous: Todo[], next: Todo[]): AppMutationOperation[] {
  const before = new Map(previous.map((todo) => [todo.id, todo]));
  const after = new Map(next.map((todo) => [todo.id, todo]));
  const operations: AppMutationOperation[] = [];
  for (const todo of next) {
    const old = before.get(todo.id);
    if (!old) { operations.push({ type: "todo.create", draft: todoDraft(todo) }); continue; }
    const patch = todoPatch(old, todo);
    if (Object.keys(patch).length) operations.push(target("todo.update", old, { patch }));
    if (old.status !== todo.status) operations.push(target(todo.status === "completed" ? "todo.complete" : "todo.reopen", old));
  }
  for (const todo of previous) if (!after.has(todo.id)) operations.push(target("todo.delete", todo));
  return operations;
}
function planOperations(previous: CyclePlan[], next: CyclePlan[]): AppMutationOperation[] {
  const before = new Map(previous.map((plan) => [plan.id, plan]));
  const after = new Map(next.map((plan) => [plan.id, plan]));
  const operations: AppMutationOperation[] = [];
  for (const plan of next) {
    const old = before.get(plan.id);
    if (!old) { operations.push({ type: "cyclePlan.create", draft: planDraft(plan) }); continue; }
    const patch = planPatch(old, plan);
    if (Object.keys(patch).length) operations.push(target("cyclePlan.update", old, { patch }));
    if (old.status !== plan.status) operations.push(target("cyclePlan.setStatus", old, { status: plan.status }));
    operations.push(...entryOperations(old, plan));
  }
  for (const plan of previous) if (!after.has(plan.id)) operations.push(target("cyclePlan.delete", plan));
  return operations;
}
function entryOperations(previous: CyclePlan, next: CyclePlan): AppMutationOperation[] {
  const before = new Map(previous.entries.map((entry) => [entry.id, entry]));
  const after = new Map(next.entries.map((entry) => [entry.id, entry]));
  const operations: AppMutationOperation[] = [];
  for (const entry of next.entries) {
    const old = before.get(entry.id);
    if (!old) { operations.push({ type: "cyclePlan.entry.create", planId: previous.id, expectedUpdatedAt: previous.updatedAt, draft: entryDraft(entry) }); continue; }
    const patch = entryPatch(old, entry);
    if (Object.keys(patch).length) operations.push(target("cyclePlan.entry.update", old, { patch }));
    if (old.status !== entry.status) operations.push(target(entry.status === "completed" ? "cyclePlan.entry.complete" : entry.status === "skipped" ? "cyclePlan.entry.skip" : "cyclePlan.entry.reopen", old));
  }
  for (const entry of previous.entries) if (!after.has(entry.id)) operations.push(target("cyclePlan.entry.delete", entry));
  return operations;
}
function target<T extends AppMutationOperation["type"]>(type: T, value: { id: string; updatedAt: string }, extra: object = {}): AppMutationOperation {
  return { type, targetId: value.id, expectedUpdatedAt: value.updatedAt, ...extra } as AppMutationOperation;
}
function todoDraft(todo: Todo) { return { title: todo.title, date: todo.date, ...(todo.notes === undefined ? {} : { notes: todo.notes }) }; }
function todoPatch(before: Todo, after: Todo) { return changed(before, after, ["title", "date", "notes"]); }
function planPatch(before: CyclePlan, after: CyclePlan) { return changed(before, after, ["title", "topic", "description"]); }
function entryPatch(before: CyclePlanEntry, after: CyclePlanEntry) {
  return { ...changed(before, after, ["date", "title", "contentSummary"]), ...(blocks(before.contentBlocks) === blocks(after.contentBlocks) ? {} : { contentBlocks: after.contentBlocks }) };
}
function planDraft(plan: CyclePlan) { return { title: plan.title, topic: plan.topic, description: plan.description, status: plan.status, entries: plan.entries.map(entryDraft) }; }
function entryDraft(entry: CyclePlanEntry) { return { date: entry.date, title: entry.title, contentSummary: entry.contentSummary, contentBlocks: entry.contentBlocks.map(blockDraft) }; }
function blockDraft(block: PlanContentBlock) { return { kind: block.kind, title: block.title, format: block.format, data: block.data }; }
function blocks(value: unknown) { return JSON.stringify((value as PlanContentBlock[]).map(blockDraft)); }
function changed<T extends object>(before: T, after: T, keys: (keyof T)[]) { return Object.fromEntries(keys.filter((key) => before[key] !== after[key]).map((key) => [key, after[key]])); }
