import type {
  CyclePlan,
  CyclePlanEntry,
  PlanContentBlock,
  Todo,
} from "../../shared/appDomainTypes.js";
import type { AppMutationBatch, AppMutationOperation } from "../../shared/appMutationTypes.js";
import { adaptCycleMutation } from "./cycleMutationAdapter.js";
import { PlanApiError } from "./planApiErrors.js";
import type { EntryVersionRecord, TaskVersionRecord } from "./planApiVersionIndex.js";
import type { PlanApiMutationBatch, PlanApiMutationOperation } from "./planApiWireTypes.js";
import { adaptTodoMutation } from "./todoMutationAdapter.js";

type DomainSnapshot = { todos: Todo[]; cyclePlans: CyclePlan[] };

export interface MutationVersionReader {
  requireTask(id: string): TaskVersionRecord;
  requireEntry(id: string): EntryVersionRecord;
}

export interface MutationAdapterInput {
  batch: AppMutationBatch;
  snapshot: DomainSnapshot;
  versionIndex: MutationVersionReader;
  idempotencyKey: string;
}

export function adaptAppMutationBatch(input: MutationAdapterInput): PlanApiMutationBatch {
  const versionIndex = new ProjectedVersionReader(input.versionIndex);
  const operations: PlanApiMutationOperation[] = [];
  let snapshot = input.snapshot;
  for (const operation of input.batch.operations) {
    const projectedInput = { ...input, snapshot, versionIndex };
    const adapted = adaptOperation(operation, projectedInput);
    operations.push(...adapted);
    versionIndex.advance(adapted);
    snapshot = projectSnapshot(snapshot, operation);
  }
  if (operations.length < 1 || operations.length > 100) {
    throw new PlanApiError("validation_failed");
  }
  return { idempotencyKey: input.idempotencyKey, operations };
}

class ProjectedVersionReader implements MutationVersionReader {
  private readonly taskVersions = new Map<string, number>();
  private readonly entryVersions = new Map<string, number>();
  private readonly deletedTasks = new Set<string>();
  private readonly deletedEntries = new Set<string>();

  constructor(private readonly base: MutationVersionReader) {}

  requireTask(id: string): TaskVersionRecord {
    if (this.deletedTasks.has(id)) throw new PlanApiError("validation_failed");
    const record = this.read(() => this.base.requireTask(id));
    return { ...record, version: this.taskVersions.get(id) ?? record.version };
  }

  requireEntry(id: string): EntryVersionRecord {
    if (this.deletedEntries.has(id)) throw new PlanApiError("validation_failed");
    const record = this.read(() => this.base.requireEntry(id));
    return { ...record, version: this.entryVersions.get(id) ?? record.version };
  }

  advance(operations: PlanApiMutationOperation[]): void {
    for (const operation of operations) {
      switch (operation.type) {
        case "task.update":
        case "task.setStatus":
          this.taskVersions.set(operation.targetId, operation.expectedVersion + 1);
          break;
        case "task.delete":
          this.deletedTasks.add(operation.targetId);
          break;
        case "entry.update":
        case "entry.complete":
        case "entry.reopen":
        case "entry.skip":
          this.entryVersions.set(operation.targetId, operation.expectedVersion + 1);
          break;
        case "entry.delete":
          this.deletedEntries.add(operation.targetId);
          break;
        case "task.create":
        case "entry.create":
          break;
        default:
          assertNever(operation);
      }
    }
  }

  private read<T>(read: () => T): T {
    try {
      return read();
    } catch (error) {
      if (error instanceof PlanApiError) throw error;
      throw new PlanApiError("validation_failed");
    }
  }
}

function adaptOperation(
  operation: AppMutationOperation,
  input: MutationAdapterInput,
): PlanApiMutationOperation[] {
  switch (operation.type) {
    case "todo.create":
    case "todo.update":
    case "todo.complete":
    case "todo.reopen":
    case "todo.delete":
      return adaptTodoMutation(operation, input);
    case "cyclePlan.create":
    case "cyclePlan.update":
    case "cyclePlan.setStatus":
    case "cyclePlan.delete":
    case "cyclePlan.entry.create":
    case "cyclePlan.entry.update":
    case "cyclePlan.entry.complete":
    case "cyclePlan.entry.reopen":
    case "cyclePlan.entry.skip":
    case "cyclePlan.entry.delete":
      return adaptCycleMutation(operation, input);
    default:
      return assertNever(operation);
  }
}

function projectSnapshot(
  snapshot: DomainSnapshot,
  operation: AppMutationOperation,
): DomainSnapshot {
  switch (operation.type) {
    case "todo.update":
      return {
        ...snapshot,
        todos: snapshot.todos.map((todo) => (
          todo.id === operation.targetId ? { ...todo, ...defined(operation.patch) } : todo
        )),
      };
    case "todo.delete":
      return { ...snapshot, todos: snapshot.todos.filter((todo) => todo.id !== operation.targetId) };
    case "cyclePlan.update":
      return {
        ...snapshot,
        cyclePlans: snapshot.cyclePlans.map((plan) => (
          plan.id === operation.targetId ? { ...plan, ...defined(operation.patch) } : plan
        )),
      };
    case "cyclePlan.delete":
      return {
        ...snapshot,
        cyclePlans: snapshot.cyclePlans.filter((plan) => plan.id !== operation.targetId),
      };
    case "cyclePlan.entry.update":
      return {
        ...snapshot,
        cyclePlans: snapshot.cyclePlans.map((plan) => ({
          ...plan,
          entries: plan.entries.map((entry) => (
            entry.id === operation.targetId ? projectEntry(entry, operation.patch) : entry
          )),
        })),
      };
    case "cyclePlan.entry.delete":
      return {
        ...snapshot,
        cyclePlans: snapshot.cyclePlans.map((plan) => ({
          ...plan,
          entries: plan.entries.filter((entry) => entry.id !== operation.targetId),
        })),
      };
    case "todo.create":
    case "todo.complete":
    case "todo.reopen":
    case "cyclePlan.create":
    case "cyclePlan.setStatus":
    case "cyclePlan.entry.create":
    case "cyclePlan.entry.complete":
    case "cyclePlan.entry.reopen":
    case "cyclePlan.entry.skip":
      return snapshot;
    default:
      return assertNever(operation);
  }
}

function projectEntry(
  entry: CyclePlanEntry,
  patch: Extract<AppMutationOperation, { type: "cyclePlan.entry.update" }>["patch"],
): CyclePlanEntry {
  const { contentBlocks: drafts, ...fields } = patch;
  const contentBlocks = drafts?.map((block, index): PlanContentBlock => ({
    schemaVersion: 2, id: `block_${index + 1}`, ...block,
  }));
  return { ...entry, ...defined(fields), ...(contentBlocks ? { contentBlocks } : {}) };
}

function defined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  ) as Partial<T>;
}

function assertNever(value: never): never {
  throw new PlanApiError("validation_failed");
}
