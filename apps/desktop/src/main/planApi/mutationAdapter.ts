import type { Todo, CyclePlan } from "../../shared/appDomainTypes.js";
import type { AppMutationBatch, AppMutationOperation } from "../../shared/appMutationTypes.js";
import { adaptCycleMutation } from "./cycleMutationAdapter.js";
import { PlanApiError } from "./planApiErrors.js";
import type { PlanApiVersionIndex } from "./planApiVersionIndex.js";
import type { PlanApiMutationBatch, PlanApiMutationOperation } from "./planApiWireTypes.js";
import { adaptTodoMutation } from "./todoMutationAdapter.js";

export interface MutationAdapterInput {
  batch: AppMutationBatch;
  snapshot: { todos: Todo[]; cyclePlans: CyclePlan[] };
  versionIndex: PlanApiVersionIndex;
  idempotencyKey: string;
}

export function adaptAppMutationBatch(input: MutationAdapterInput): PlanApiMutationBatch {
  const operations = input.batch.operations.flatMap((operation) => {
    validateTarget(operation, input);
    return adaptOperation(operation, input);
  });
  if (operations.length < 1 || operations.length > 100) {
    throw new PlanApiError("validation_failed");
  }
  return { idempotencyKey: input.idempotencyKey, operations };
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
  }
  return assertNever(operation);
}

function validateTarget(operation: AppMutationOperation, input: MutationAdapterInput): void {
  switch (operation.type) {
    case "todo.create":
    case "cyclePlan.create":
      return;
    case "cyclePlan.entry.create": {
      const plan = input.snapshot.cyclePlans.find((item) => item.id === operation.planId);
      if (!plan) throw new PlanApiError("validation_failed");
      const record = requireVersion(() => input.versionIndex.requireTask(operation.planId));
      assertExpected(record.updatedAt, operation.expectedUpdatedAt);
      return;
    }
    case "todo.update":
    case "todo.complete":
    case "todo.reopen":
    case "todo.delete": {
      const todo = input.snapshot.todos.find((item) => item.id === operation.targetId);
      if (!todo) throw new PlanApiError("validation_failed");
      const record = requireVersion(() => input.versionIndex.requireEntry(operation.targetId));
      assertExpected(record.updatedAt, operation.expectedUpdatedAt);
      return;
    }
    case "cyclePlan.update":
    case "cyclePlan.setStatus":
    case "cyclePlan.delete": {
      const plan = input.snapshot.cyclePlans.find((item) => item.id === operation.targetId);
      if (!plan) throw new PlanApiError("validation_failed");
      const record = requireVersion(() => input.versionIndex.requireTask(operation.targetId));
      assertExpected(record.updatedAt, operation.expectedUpdatedAt);
      return;
    }
    case "cyclePlan.entry.update":
    case "cyclePlan.entry.complete":
    case "cyclePlan.entry.reopen":
    case "cyclePlan.entry.skip":
    case "cyclePlan.entry.delete": {
      const entry = input.snapshot.cyclePlans
        .flatMap((plan) => plan.entries)
        .find((item) => item.id === operation.targetId);
      if (!entry) throw new PlanApiError("validation_failed");
      const record = requireVersion(() => input.versionIndex.requireEntry(operation.targetId));
      assertExpected(record.updatedAt, operation.expectedUpdatedAt);
      return;
    }
  }
  return assertNever(operation);
}

function requireVersion<T>(read: () => T): T {
  try {
    return read();
  } catch {
    throw new PlanApiError("validation_failed");
  }
}

function assertExpected(actual: string, expected?: string): void {
  if (expected !== undefined && actual !== expected) {
    throw new PlanApiError("version_conflict");
  }
}

function assertNever(value: never): never {
  throw new PlanApiError("validation_failed");
}
