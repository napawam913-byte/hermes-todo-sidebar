import type { CyclePlan, CyclePlanEntry, PlanContentBlock } from "../../shared/appDomainTypes.js";
import type { AppMutationOperation } from "../../shared/appMutationTypes.js";
import type { CyclePlanEntryCreateDraft } from "../../shared/aiMutationTypes.js";
import {
  cycleEntryToContentDocument,
  cyclePlanToContentDocument,
} from "./contentDocumentMapper.js";
import { PlanApiError } from "./planApiErrors.js";
import type { MutationAdapterInput } from "./mutationAdapter.js";
import type {
  PlanApiMutationOperation,
  PlanApiTaskEntryDraft,
  PlanApiTaskView,
} from "./planApiWireTypes.js";

type CycleMutation = Exclude<AppMutationOperation, { type: `todo.${string}` }>;
type EntryTargetMutation = Extract<CycleMutation, {
  type:
    | "cyclePlan.entry.update"
    | "cyclePlan.entry.complete"
    | "cyclePlan.entry.reopen"
    | "cyclePlan.entry.skip"
    | "cyclePlan.entry.delete";
}>;

export function adaptCycleMutation(
  operation: CycleMutation,
  input: MutationAdapterInput,
): PlanApiMutationOperation[] {
  if (operation.type === "cyclePlan.create") {
    const plan = planFromDraft(operation.draft);
    return [{
      type: "task.create",
      draft: {
        kind: "cycle",
        status: taskStatus(operation.draft.status ?? "active"),
        generation_mode: "fixed",
        content: cyclePlanToContentDocument(plan),
        schedule_rule: null,
        generated_through_date: null,
        rule_revision: 1,
        entries: (operation.draft.entries ?? []).map((draft) => entryDraft(draft, input)),
      },
    }];
  }
  if (operation.type === "cyclePlan.entry.create") {
    return [{
      type: "entry.create",
      taskId: operation.planId,
      draft: entryDraft(operation.draft, input),
    }];
  }
  switch (operation.type) {
    case "cyclePlan.entry.update":
    case "cyclePlan.entry.complete":
    case "cyclePlan.entry.reopen":
    case "cyclePlan.entry.skip":
    case "cyclePlan.entry.delete":
      return adaptEntryMutation(operation, input);
  }

  const plan = requirePlan(operation.targetId, input);
  const version = input.versionIndex.requireTask(plan.id);
  if (operation.type === "cyclePlan.update") {
    const next = {
      ...plan,
      ...(operation.patch.title !== undefined ? { title: operation.patch.title } : {}),
      ...(operation.patch.topic !== undefined ? { topic: operation.patch.topic } : {}),
      ...(operation.patch.description !== undefined ? { description: operation.patch.description } : {}),
    };
    return [{
      type: "task.update",
      targetId: plan.id,
      expectedVersion: version.version,
      patch: { content: cyclePlanToContentDocument(next) },
    }];
  }
  if (operation.type === "cyclePlan.setStatus") {
    return [{
      type: "task.setStatus",
      targetId: plan.id,
      expectedVersion: version.version,
      status: taskStatus(operation.status),
    }];
  }
  if (operation.type === "cyclePlan.delete") {
    return [{ type: "task.delete", targetId: plan.id, expectedVersion: version.version }];
  }
  return assertNever(operation);
}

function adaptEntryMutation(
  operation: EntryTargetMutation,
  input: MutationAdapterInput,
): PlanApiMutationOperation[] {
  const entry = requireEntry(operation.targetId, input);
  const version = input.versionIndex.requireEntry(entry.id);
  if (operation.type === "cyclePlan.entry.update") {
    const next = mergeEntry(entry, operation.patch);
    const changesContent = operation.patch.title !== undefined
      || operation.patch.contentSummary !== undefined
      || operation.patch.contentBlocks !== undefined;
    const patch: Record<string, unknown> = {};
    if (operation.patch.date !== undefined) patch.scheduled_date = operation.patch.date;
    if (changesContent) patch.content = cycleEntryToContentDocument(next);
    return [{ type: "entry.update", targetId: entry.id, expectedVersion: version.version, patch }];
  }
  switch (operation.type) {
    case "cyclePlan.entry.complete":
      return [{ type: "entry.complete", targetId: entry.id, expectedVersion: version.version }];
    case "cyclePlan.entry.reopen":
      return [{ type: "entry.reopen", targetId: entry.id, expectedVersion: version.version }];
    case "cyclePlan.entry.skip":
      return [{ type: "entry.skip", targetId: entry.id, expectedVersion: version.version }];
    case "cyclePlan.entry.delete":
      return [{ type: "entry.delete", targetId: entry.id, expectedVersion: version.version }];
  }
  return assertNever(operation);
}

function entryDraft(
  draft: CyclePlanEntryCreateDraft,
  input: MutationAdapterInput,
): PlanApiTaskEntryDraft {
  return {
    scheduled_date: draft.date,
    status: "pending",
    content: cycleEntryToContentDocument(entryFromDraft(draft)),
    source: input.batch.source.type === "manual" ? "manual" : "hermes",
    slot_key: null,
    is_overridden: false,
    generation_revision: null,
    completed_at: null,
  };
}

function planFromDraft(draft: {
  title: string; topic: string; description: string;
  status?: CyclePlan["status"]; entries?: CyclePlanEntryCreateDraft[];
}): CyclePlan {
  return {
    schemaVersion: 2, id: "", title: draft.title, topic: draft.topic,
    description: draft.description, status: draft.status ?? "active",
    source: { type: "manual" }, entries: [], createdAt: "", updatedAt: "",
  };
}

function entryFromDraft(draft: CyclePlanEntryCreateDraft): CyclePlanEntry {
  return {
    schemaVersion: 2, id: "", planId: "", date: draft.date, title: draft.title,
    contentSummary: draft.contentSummary, contentBlocks: blocksFromDraft(draft.contentBlocks),
    status: "pending", source: { type: "manual" }, createdAt: "", updatedAt: "",
  };
}

function blocksFromDraft(
  blocks: CyclePlanEntryCreateDraft["contentBlocks"],
): PlanContentBlock[] {
  return blocks.map((block, index) => ({ schemaVersion: 2, id: `block_${index + 1}`, ...block }));
}

function mergeEntry(
  entry: CyclePlanEntry,
  patch: Partial<CyclePlanEntryCreateDraft>,
): CyclePlanEntry {
  return {
    ...entry,
    ...(patch.date !== undefined ? { date: patch.date } : {}),
    ...(patch.title !== undefined ? { title: patch.title } : {}),
    ...(patch.contentSummary !== undefined ? { contentSummary: patch.contentSummary } : {}),
    ...(patch.contentBlocks !== undefined ? { contentBlocks: blocksFromDraft(patch.contentBlocks) } : {}),
  };
}

function taskStatus(status: CyclePlan["status"]): PlanApiTaskView["status"] {
  return status === "draft" ? "paused" : status;
}

function requirePlan(id: string, input: MutationAdapterInput): CyclePlan {
  const plan = input.snapshot.cyclePlans.find((item) => item.id === id);
  if (!plan) throw new PlanApiError("validation_failed");
  return plan;
}

function requireEntry(id: string, input: MutationAdapterInput): CyclePlanEntry {
  const entry = input.snapshot.cyclePlans.flatMap((plan) => plan.entries)
    .find((item) => item.id === id);
  if (!entry) throw new PlanApiError("validation_failed");
  return entry;
}

function assertNever(value: never): never {
  throw new PlanApiError("validation_failed");
}
