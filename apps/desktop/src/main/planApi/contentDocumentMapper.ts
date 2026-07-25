import type { CyclePlan, CyclePlanEntry, PlanContentBlock, Todo } from "../../shared/appDomainTypes.js";
import type { PlanApiContentDocument, PlanApiContentSection } from "./planApiWireTypes.js";

const contentBlockField = (block: PlanContentBlock) => ({
  key: "contentBlock", label: block.title, type: "object", value: block,
});

export function todoToContentDocument(todo: Todo): PlanApiContentDocument {
  const notes = todo.notes?.trim();
  return {
    schemaVersion: 1, kind: "todo.general", title: todo.title, summary: notes || todo.title, locale: "zh-CN",
    sections: notes ? [{
      id: "notes", label: "备注", layout: "markdown",
      fields: [{ key: "notes", label: "备注", type: "markdown", value: notes }], items: [],
    }] : [],
  };
}

export function cyclePlanToContentDocument(plan: CyclePlan): PlanApiContentDocument {
  return {
    schemaVersion: 1, kind: "plan.cycle", title: plan.title, summary: plan.description, locale: "zh-CN",
    sections: [{
      id: "metadata", label: "元数据", layout: "fields",
      fields: [{ key: "topic", label: "主题", type: "string", value: plan.topic }], items: [],
    }],
  };
}

export function cycleEntryToContentDocument(entry: CyclePlanEntry): PlanApiContentDocument {
  return {
    schemaVersion: 1, kind: "plan.cycle_entry", title: entry.title, summary: entry.contentSummary, locale: "zh-CN",
    sections: entry.contentBlocks.map((block) => ({
      id: block.id, label: block.title, layout: block.format === "markdown" ? "markdown" : "fields",
      fields: [contentBlockField(block)], items: [],
    })),
  };
}

export function contentDocumentToBlocks(content: PlanApiContentDocument): PlanContentBlock[] {
  return content.sections.map((section) => (
    content.kind === "plan.cycle_entry" ? readContentBlock(section) ?? genericBlock(content.kind, section) : genericBlock(content.kind, section)
  ));
}

function readContentBlock(section: PlanApiContentSection): PlanContentBlock | undefined {
  const value = section.fields.find((field) => field.key === "contentBlock")?.value;
  if (!isContentBlock(value)) return undefined;
  return value;
}

function genericBlock(kind: string, section: PlanApiContentSection): PlanContentBlock {
  return {
    schemaVersion: 2, id: section.id, kind: `${kind}.${section.id}`, title: section.label,
    format: section.layout === "markdown" ? "markdown" : "json", data: { ...section },
  };
}

function isContentBlock(value: unknown): value is PlanContentBlock {
  if (!isRecord(value)) return false;
  return value.schemaVersion === 2
    && typeof value.id === "string"
    && typeof value.kind === "string"
    && typeof value.title === "string"
    && (value.format === "json" || value.format === "markdown")
    && isRecord(value.data);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
