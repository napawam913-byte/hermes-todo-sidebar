/**
 * 模块用途：限制模型内容块的数量与 JSON 资源消耗，同时保留开放的合法数据结构。
 * 模块边界：不解释内容块业务语义，只校验可安全传递的 JSON 值。
 */
import type { ContentBlockDraft } from "./aiMutationTypes.js";

export const MAX_CONTENT_BLOCKS = 20;
export const MAX_CONTENT_BLOCK_TEXT_LENGTH = 500;
export const MAX_CONTENT_BLOCK_DATA_STRING_LENGTH = 10_000;
export const MAX_CONTENT_BLOCK_DATA_JSON_BYTES = 48_000;
export const MAX_CONTENT_BLOCK_DATA_DEPTH = 8;
export const MAX_CONTENT_BLOCK_DATA_NODES = 500;

export function parseContentBlocks(value: unknown): ContentBlockDraft[] {
  if (!Array.isArray(value)) throw new Error("contentBlocks 必须是数组");
  if (value.length > MAX_CONTENT_BLOCKS) throw new Error("contentBlocks 数量超出限制");
  return value.map((item) => {
    const block = asRecord(item, "内容块必须是对象");
    exactKeys(block, ["kind", "title", "format", "data"]);
    if (block.format !== "json" && block.format !== "markdown") throw new Error("内容块格式无效");
    return {
      kind: readBlockText(block.kind, "内容块 kind"),
      title: readBlockText(block.title, "内容块标题"),
      format: block.format,
      data: parseContentBlockData(block.data)
    };
  });
}

function readBlockText(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label}不能为空`);
  if (value.length > MAX_CONTENT_BLOCK_TEXT_LENGTH) throw new Error(`${label}字符串过长`);
  return value.trim();
}

function parseContentBlockData(value: unknown): Record<string, unknown> {
  const data = asRecord(value, "contentBlocks.data 必须是对象");
  const counter = { nodes: 0 };
  validateJsonValue(data, 1, counter);
  let json: string;
  try { json = JSON.stringify(data); } catch { throw new Error("contentBlocks.data 必须是 JSON"); }
  if (new TextEncoder().encode(json).byteLength > MAX_CONTENT_BLOCK_DATA_JSON_BYTES) {
    throw new Error("contentBlocks.data JSON 大小超出限制");
  }
  return data;
}

function validateJsonValue(value: unknown, depth: number, counter: { nodes: number }): void {
  if (depth > MAX_CONTENT_BLOCK_DATA_DEPTH) throw new Error("contentBlocks.data JSON 深度超出限制");
  counter.nodes += 1;
  if (counter.nodes > MAX_CONTENT_BLOCK_DATA_NODES) throw new Error("contentBlocks.data JSON 节点超出限制");
  if (typeof value === "string") {
    if (value.length > MAX_CONTENT_BLOCK_DATA_STRING_LENGTH) throw new Error("contentBlocks.data 字符串过长");
    return;
  }
  if (value === null || typeof value === "boolean" || typeof value === "number") return;
  if (Array.isArray(value)) {
    value.forEach((item) => validateJsonValue(item, depth + 1, counter));
    return;
  }
  if (!value || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new Error("contentBlocks.data 必须是 JSON");
  }
  Object.values(value).forEach((item) => validateJsonValue(item, depth + 1, counter));
}

function asRecord(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(message);
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, allowed: string[]): void {
  const unknown = Object.keys(value).find((key) => !allowed.includes(key));
  if (unknown) throw new Error(`未知字段：${unknown}`);
  const missing = allowed.find((key) => !(key in value));
  if (missing) throw new Error(`缺少字段：${missing}`);
}
