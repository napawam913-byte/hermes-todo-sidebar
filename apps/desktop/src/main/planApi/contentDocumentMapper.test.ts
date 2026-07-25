import { describe, expect, it } from "vitest";
import type { CyclePlan, CyclePlanEntry, Todo } from "../../shared/appDomainTypes.js";
import {
  contentDocumentToBlocks,
  cycleEntryToContentDocument,
  cyclePlanToContentDocument,
  todoToContentDocument,
} from "./contentDocumentMapper.js";

const todo: Todo = {
  id: "todo_1", title: "Read chapter", date: "2026-07-25", notes: "  Take notes.  ",
  status: "pending", syncStatus: "local", source: { type: "manual" },
  createdAt: "2026-07-25T00:00:00.000Z", updatedAt: "2026-07-25T00:00:00.000Z", snoozeCount: 0,
};

const entry: CyclePlanEntry = {
  schemaVersion: 2, id: "entry_1", planId: "plan_1", date: "2026-07-25", title: "Upper body",
  contentSummary: "Bench press", status: "pending", source: { type: "manual" },
  createdAt: "2026-07-25T00:00:00.000Z", updatedAt: "2026-07-25T00:00:00.000Z",
  contentBlocks: [{
    schemaVersion: 2, id: "block_1", kind: "fitness.exercise_list", title: "Exercises",
    format: "json", data: { exercises: [{ name: "Bench press" }] },
  }, {
    schemaVersion: 2, id: "block_2", kind: "generic.notes", title: "Notes",
    format: "markdown", data: { markdown: "Recover well." },
  }],
};

const plan: CyclePlan = {
  schemaVersion: 2, id: "plan_1", title: "Strength", topic: "Fitness", description: "Three days weekly",
  status: "active", source: { type: "manual" }, entries: [entry],
  createdAt: "2026-07-25T00:00:00.000Z", updatedAt: "2026-07-25T00:00:00.000Z",
};

describe("content document mapper", () => {
  it("preserves an unknown content section as a generic block", () => {
    const blocks = contentDocumentToBlocks({
      schemaVersion: 1, kind: "language.shadowing", title: "Shadowing", summary: "Third segment", locale: "zh-CN",
      sections: [{
        id: "segment", label: "Study segment", layout: "fields",
        fields: [{ key: "repeat", label: "Repeats", type: "number", value: 4 }], items: [],
      }],
    });

    expect(blocks[0]).toMatchObject({ kind: "language.shadowing.segment", title: "Study segment", format: "json" });
    expect(blocks[0].data).toMatchObject({ layout: "fields" });
  });

  it("keeps contentBlock-shaped fields generic for an unknown document kind", () => {
    const blocks = contentDocumentToBlocks({
      schemaVersion: 1, kind: "language.shadowing", title: "Shadowing", summary: "Third segment", locale: "zh-CN",
      sections: [{
        id: "segment", label: "Study segment", layout: "fields", items: [],
        fields: [{ key: "contentBlock", label: "Payload", type: "object", value: entry.contentBlocks[0] }],
      }],
    });

    expect(blocks[0]).toMatchObject({ kind: "language.shadowing.segment", format: "json" });
    expect(blocks[0].data).toMatchObject({ fields: expect.any(Array) });
  });

  it("keeps non-object contentBlock fields generic in cycle entries", () => {
    const section = {
      id: "segment", label: "Study segment", layout: "list" as const,
      fields: [{ key: "contentBlock", label: "Payload", type: "markdown", value: entry.contentBlocks[0] }],
      items: [{ title: "Keep this", fields: [] }],
    };
    const [block] = contentDocumentToBlocks({
      schemaVersion: 1, kind: "plan.cycle_entry", title: "Entry", summary: "Summary", locale: "zh-CN",
      sections: [section],
    });

    expect(block).toMatchObject({ kind: "plan.cycle_entry.segment", format: "json" });
    expect(block.data).toEqual(section);
  });

  it("maps Todo notes into the fixed markdown document", () => {
    expect(todoToContentDocument(todo)).toEqual({
      schemaVersion: 1, kind: "todo.general", title: "Read chapter", summary: "Take notes.", locale: "zh-CN",
      sections: [{ id: "notes", label: "备注", layout: "markdown", fields: [
        { key: "notes", label: "备注", type: "markdown", value: "Take notes." },
      ], items: [] }],
    });
  });

  it("stores the cycle plan topic in metadata", () => {
    expect(cyclePlanToContentDocument(plan)).toEqual({
      schemaVersion: 1, kind: "plan.cycle", title: "Strength", summary: "Three days weekly", locale: "zh-CN",
      sections: [{ id: "metadata", label: "元数据", layout: "fields", fields: [
        { key: "topic", label: "主题", type: "string", value: "Fitness" },
      ], items: [] }],
    });
  });

  it("round-trips cycle entry JSON and markdown blocks through contentBlock fields", () => {
    const content = cycleEntryToContentDocument(entry);

    expect(content).toMatchObject({ kind: "plan.cycle_entry", title: "Upper body", summary: "Bench press" });
    expect(content.sections.map((section) => section.fields[0])).toEqual([
      { key: "contentBlock", label: "Exercises", type: "object", value: entry.contentBlocks[0] },
      { key: "contentBlock", label: "Notes", type: "object", value: entry.contentBlocks[1] },
    ]);
    expect(contentDocumentToBlocks(content)).toEqual(entry.contentBlocks);
  });
});
