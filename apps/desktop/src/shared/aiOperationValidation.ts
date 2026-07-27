/**
 * 模块用途：把单条未知模型输出解析为操作白名单中的类型化变更。
 * 模块边界：只校验操作及其字段，不校验提案外层或访问当前本地状态。
 */
import type {
  AiMutationOperation,
  ContentBlockDraft,
  CyclePlanEntryCreateDraft
} from "./aiMutationTypes.js";

type JsonRecord = Record<string, unknown>;

const TARGET_ONLY = new Set([
  "todo.complete",
  "todo.reopen",
  "todo.delete",
  "cyclePlan.delete",
  "cyclePlan.entry.complete",
  "cyclePlan.entry.reopen",
  "cyclePlan.entry.skip",
  "cyclePlan.entry.delete"
]);

export function parseMutationOperation(value: unknown): AiMutationOperation {
  const operation = asRecord(value, "操作必须是对象");
  const type = readString(operation.type, "操作 type");

  if (type === "todo.create") {
    exactKeys(operation, ["type", "draft"]);
    return { type, draft: parseTodoDraft(operation.draft) };
  }
  if (type === "todo.update") {
    exactKeys(operation, ["type", "targetId", "patch"]);
    return { type, targetId: readId(operation.targetId), patch: parseTodoPatch(operation.patch) };
  }
  if (type === "cyclePlan.create") {
    exactKeys(operation, ["type", "draft"]);
    const draft = asRecord(operation.draft, "周期计划 draft 必须是对象");
    exactKeys(draft, ["title", "topic", "description", "status", "entries"], ["status", "entries"]);
    return {
      type,
      draft: {
        title: readText(draft.title, "计划标题"),
        topic: readText(draft.topic, "计划主题"),
        description: readString(draft.description, "计划说明"),
        status: draft.status === undefined ? undefined : readPlanStatus(draft.status),
        entries: draft.entries === undefined ? undefined : parseEntryDrafts(draft.entries)
      }
    };
  }
  if (type === "cyclePlan.update") {
    exactKeys(operation, ["type", "targetId", "patch"]);
    return { type, targetId: readId(operation.targetId), patch: parsePlanPatch(operation.patch) };
  }
  if (type === "cyclePlan.setStatus") {
    exactKeys(operation, ["type", "targetId", "status"]);
    return {
      type,
      targetId: readId(operation.targetId),
      status: readPlanStatus(operation.status)
    };
  }
  if (type === "cyclePlan.entry.create") {
    exactKeys(operation, ["type", "planId", "draft"]);
    return {
      type,
      planId: readId(operation.planId),
      draft: parseEntryDraft(operation.draft)
    };
  }
  if (type === "cyclePlan.entry.update") {
    exactKeys(operation, ["type", "targetId", "patch"]);
    return {
      type,
      targetId: readId(operation.targetId),
      patch: parseEntryPatch(operation.patch)
    };
  }
  if (TARGET_ONLY.has(type)) {
    exactKeys(operation, ["type", "targetId"]);
    return { type, targetId: readId(operation.targetId) } as AiMutationOperation;
  }
  throw new Error(`不支持的操作：${type}`);
}

function parseTodoDraft(value: unknown) {
  const draft = asRecord(value, "待办 draft 必须是对象");
  exactKeys(draft, ["title", "date", "notes"], ["notes"]);
  return {
    title: readText(draft.title, "待办标题"),
    date: readDate(draft.date),
    notes: optionalString(draft.notes, "待办备注")
  };
}

function parseTodoPatch(value: unknown) {
  const patch = asRecord(value, "待办 patch 必须是对象");
  exactKeys(patch, ["title", "date", "notes"], ["title", "date", "notes"]);
  requireChange(patch);
  return {
    title: patch.title === undefined ? undefined : readText(patch.title, "待办标题"),
    date: patch.date === undefined ? undefined : readDate(patch.date),
    notes: optionalString(patch.notes, "待办备注")
  };
}

function parsePlanPatch(value: unknown) {
  const patch = asRecord(value, "周期计划 patch 必须是对象");
  exactKeys(patch, ["title", "topic", "description"], ["title", "topic", "description"]);
  requireChange(patch);
  return {
    title: patch.title === undefined ? undefined : readText(patch.title, "计划标题"),
    topic: patch.topic === undefined ? undefined : readText(patch.topic, "计划主题"),
    description: optionalString(patch.description, "计划说明")
  };
}

function parseEntryDraft(value: unknown): CyclePlanEntryCreateDraft {
  const draft = asRecord(value, "计划条目 draft 必须是对象");
  exactKeys(draft, ["date", "title", "contentSummary", "contentBlocks"]);
  return {
    date: readDate(draft.date),
    title: readText(draft.title, "条目标题"),
    contentSummary: readString(draft.contentSummary, "条目摘要"),
    contentBlocks: parseContentBlocks(draft.contentBlocks)
  };
}

function parseEntryDrafts(value: unknown): CyclePlanEntryCreateDraft[] {
  if (!Array.isArray(value)) throw new Error("计划 entries 必须是数组");
  if (value.length > 50) throw new Error("单个新计划最多包含 50 个条目");
  return value.map(parseEntryDraft);
}

function parseEntryPatch(value: unknown) {
  const patch = asRecord(value, "计划条目 patch 必须是对象");
  exactKeys(
    patch,
    ["date", "title", "contentSummary", "contentBlocks"],
    ["date", "title", "contentSummary", "contentBlocks"]
  );
  requireChange(patch);
  return {
    date: patch.date === undefined ? undefined : readDate(patch.date),
    title: patch.title === undefined ? undefined : readText(patch.title, "条目标题"),
    contentSummary: optionalString(patch.contentSummary, "条目摘要"),
    contentBlocks: patch.contentBlocks === undefined
      ? undefined
      : parseContentBlocks(patch.contentBlocks)
  };
}

function parseContentBlocks(value: unknown): ContentBlockDraft[] {
  if (!Array.isArray(value)) throw new Error("contentBlocks 必须是数组");
  return value.map((item) => {
    const block = asRecord(item, "内容块必须是对象");
    exactKeys(block, ["kind", "title", "format", "data"]);
    const format = block.format;
    if (format !== "json" && format !== "markdown") throw new Error("内容块格式无效");
    return {
      kind: readText(block.kind, "内容块 kind"),
      title: readText(block.title, "内容块标题"),
      format,
      data: asRecord(block.data, "contentBlocks.data 必须是对象")
    };
  });
}

export function asRecord(value: unknown, message: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(message);
  return value as JsonRecord;
}

export function exactKeys(value: JsonRecord, allowed: string[], optional: string[] = []): void {
  const unknown = Object.keys(value).find((key) => !allowed.includes(key));
  if (unknown) throw new Error(`未知字段：${unknown}`);
  const missing = allowed.find((key) => !optional.includes(key) && !(key in value));
  if (missing) throw new Error(`缺少字段：${missing}`);
}

function readId(value: unknown): string { return readText(value, "目标 ID"); }
function readText(value: unknown, label: string): string {
  const text = readString(value, label).trim();
  if (!text) throw new Error(`${label}不能为空`);
  return text;
}
function readString(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`${label}必须是字符串`);
  return value;
}
function readDate(value: unknown): string {
  const date = readString(value, "日期");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("日期必须使用 YYYY-MM-DD");
  return date;
}
function optionalString(value: unknown, label: string): string | undefined {
  return value === undefined ? undefined : readString(value, label);
}
function readPlanStatus(value: unknown) {
  if (value === "draft" || value === "active" || value === "paused" || value === "archived") return value;
  throw new Error("周期计划状态无效");
}
function requireChange(value: JsonRecord): void {
  if (!Object.values(value).some((item) => item !== undefined)) throw new Error("patch 至少包含一个字段");
}
