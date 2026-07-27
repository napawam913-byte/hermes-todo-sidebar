/**
 * 模块用途：提供 OpenAI 兼容 response_format 使用的提案 JSON Schema。
 * 模块边界：服务端 Schema 约束输出形状，本地解析器仍是最终安全边界。
 */
const contentBlock = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "title", "format", "data"],
  properties: {
    kind: { type: "string" },
    title: { type: "string" },
    format: { type: "string", enum: ["json", "markdown"] },
    data: { type: "object", additionalProperties: true }
  }
};

const entryDraft = {
  type: "object",
  additionalProperties: false,
  required: ["date", "title", "contentSummary", "contentBlocks"],
  properties: {
    date: { type: "string" },
    title: { type: "string" },
    contentSummary: { type: "string" },
    contentBlocks: { type: "array", items: contentBlock }
  }
};

const operation = {
  type: "object",
  additionalProperties: false,
  required: ["type"],
  properties: {
    type: {
      type: "string",
      enum: [
        "todo.create", "todo.update", "todo.complete", "todo.reopen", "todo.delete",
        "cyclePlan.create", "cyclePlan.update", "cyclePlan.setStatus", "cyclePlan.delete",
        "cyclePlan.entry.create", "cyclePlan.entry.update", "cyclePlan.entry.complete",
        "cyclePlan.entry.reopen", "cyclePlan.entry.skip", "cyclePlan.entry.delete"
      ]
    },
    targetId: { type: "string" },
    planId: { type: "string" },
    status: { type: "string", enum: ["draft", "active", "paused", "archived"] },
    draft: {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string" },
        date: { type: "string" },
        notes: { type: "string" },
        topic: { type: "string" },
        description: { type: "string" },
        status: { type: "string" },
        contentSummary: { type: "string" },
        contentBlocks: { type: "array", items: contentBlock },
        entries: { type: "array", maxItems: 50, items: entryDraft }
      }
    },
    patch: {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string" },
        date: { type: "string" },
        notes: { type: "string" },
        topic: { type: "string" },
        description: { type: "string" },
        contentSummary: { type: "string" },
        contentBlocks: { type: "array", items: contentBlock }
      }
    }
  }
};

export const AI_MUTATION_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "summary", "operations"],
  properties: {
    schemaVersion: { type: "integer", const: 1 },
    summary: { type: "string" },
    operations: { type: "array", maxItems: 50, items: operation }
  }
} as const;
