/**
 * 模块用途：在手动编辑表单草稿与统一 CyclePlan v2 JSON 之间进行纯数据转换。
 * 模块边界：只生成 generic.note Markdown 块并保留未知专业块，不操作 React 或仓储。
 */
import {
  CYCLE_PLAN_SCHEMA_VERSION,
  type CyclePlan,
  type CyclePlanEntry,
  type PlanContentBlock
} from "./cyclePlanTypes";

export interface CyclePlanEntryDraft {
  draftId: string;
  entryId?: string;
  date: string;
  title: string;
  contentSummary: string;
  markdown: string;
}

export interface CyclePlanDraft {
  planId?: string;
  title: string;
  topic: string;
  description: string;
  entries: CyclePlanEntryDraft[];
}

interface CreateDraftOptions {
  dateKey: string;
  idFactory: () => string;
  plan?: CyclePlan;
}

interface SaveDraftOptions {
  existingPlan?: CyclePlan;
  idFactory: () => string;
  now: Date;
}

export function createCyclePlanDraft(options: CreateDraftOptions): CyclePlanDraft {
  if (!options.plan) {
    return {
      title: "",
      topic: "",
      description: "",
      entries: [createCyclePlanEntryDraft(options.dateKey, options.idFactory)]
    };
  }

  return {
    planId: options.plan.id,
    title: options.plan.title,
    topic: options.plan.topic,
    description: options.plan.description,
    entries: options.plan.entries.map((entry) => ({
      draftId: options.idFactory(),
      entryId: entry.id,
      date: entry.date,
      title: entry.title,
      contentSummary: entry.contentSummary,
      markdown: readMarkdown(entry.contentBlocks)
    }))
  };
}

export function createCyclePlanEntryDraft(
  dateKey: string,
  idFactory: () => string
): CyclePlanEntryDraft {
  return {
    draftId: idFactory(),
    date: dateKey,
    title: "",
    contentSummary: "",
    markdown: ""
  };
}

export function saveCyclePlanDraft(
  draft: CyclePlanDraft,
  options: SaveDraftOptions
): CyclePlan {
  const timestamp = options.now.toISOString();
  const existingPlan = options.existingPlan;
  const planId = existingPlan?.id ?? draft.planId ?? options.idFactory();
  const existingEntries = new Map(existingPlan?.entries.map((entry) => [entry.id, entry]));

  return {
    schemaVersion: CYCLE_PLAN_SCHEMA_VERSION,
    id: planId,
    title: draft.title.trim(),
    topic: draft.topic.trim(),
    description: draft.description.trim(),
    status: existingPlan?.status ?? "active",
    source: existingPlan?.source ?? { type: "manual" },
    createdAt: existingPlan?.createdAt ?? timestamp,
    updatedAt: timestamp,
    entries: draft.entries.map((entryDraft) =>
      saveEntry(entryDraft, planId, existingEntries.get(entryDraft.entryId ?? ""), options)
    )
  };
}

export function upsertCyclePlan(plans: CyclePlan[], plan: CyclePlan): CyclePlan[] {
  const index = plans.findIndex((current) => current.id === plan.id);
  if (index < 0) return [plan, ...plans];
  return plans.map((current) => (current.id === plan.id ? plan : current));
}

function saveEntry(
  draft: CyclePlanEntryDraft,
  planId: string,
  existing: CyclePlanEntry | undefined,
  options: SaveDraftOptions
): CyclePlanEntry {
  const timestamp = options.now.toISOString();
  return {
    schemaVersion: CYCLE_PLAN_SCHEMA_VERSION,
    id: existing?.id ?? draft.entryId ?? options.idFactory(),
    planId,
    date: draft.date,
    title: draft.title.trim(),
    contentSummary: draft.contentSummary.trim(),
    contentBlocks: buildContentBlocks(draft.markdown, existing?.contentBlocks ?? [], options.idFactory),
    status: existing?.status ?? "pending",
    source: existing?.source ?? { type: "manual" },
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
    completedAt: existing?.completedAt
  };
}

function buildContentBlocks(
  markdown: string,
  existingBlocks: PlanContentBlock[],
  idFactory: () => string
): PlanContentBlock[] {
  const specializedBlocks = existingBlocks.filter((block) => block.kind !== "generic.note");
  const trimmedMarkdown = markdown.trim();
  if (!trimmedMarkdown) return specializedBlocks;

  const existingNote = existingBlocks.find((block) => block.kind === "generic.note");
  return [
    ...specializedBlocks,
    {
      schemaVersion: CYCLE_PLAN_SCHEMA_VERSION,
      id: existingNote?.id ?? idFactory(),
      kind: "generic.note",
      title: existingNote?.title ?? "计划详情",
      format: "markdown",
      data: { markdown: trimmedMarkdown }
    }
  ];
}

function readMarkdown(blocks: PlanContentBlock[]): string {
  const note = blocks.find((block) => block.kind === "generic.note");
  return note?.format === "markdown" && typeof note.data.markdown === "string"
    ? note.data.markdown
    : "";
}
