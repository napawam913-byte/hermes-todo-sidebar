/**
 * 模块用途：把 renderer 或浏览器预览提交的未知值解析为通用变更批次白名单。
 * 模块边界：只校验批次、来源、操作和版本元数据，不访问当前业务数据。
 */
import type { AppMutationBatch, AppMutationOperation, AppMutationSource } from "./appMutationTypes.js";
import { asRecord, exactKeys, parseMutationOperation } from "./aiOperationValidation.js";

export function parseAppMutationBatch(value: unknown): AppMutationBatch {
  const batch = asRecord(value, "变更批次必须是对象");
  exactKeys(batch, ["source", "summary", "operations"]);
  const summary = readText(batch.summary, "变更摘要", 500);
  if (!Array.isArray(batch.operations)) throw new Error("operations 必须是数组");
  if (batch.operations.length > 50) throw new Error("单批操作不能超过 50 项");
  return {
    source: parseSource(batch.source),
    summary,
    operations: batch.operations.map(parseAppOperation)
  };
}

function parseSource(value: unknown): AppMutationSource {
  const source = asRecord(value, "变更来源必须是对象");
  if (source.type === "manual") {
    exactKeys(source, ["type"]);
    return { type: "manual" };
  }
  if (source.type === "ai_draft") {
    exactKeys(source, ["type", "proposalId"]);
    return { type: "ai_draft", proposalId: readText(source.proposalId, "proposalId", 200) };
  }
  throw new Error("变更来源不在白名单中");
}

function parseAppOperation(value: unknown): AppMutationOperation {
  const operation = asRecord(value, "操作必须是对象");
  const expectedUpdatedAt = operation.expectedUpdatedAt;
  const targetLabel = operation.targetLabel;
  const core = { ...operation };
  delete core.expectedUpdatedAt;
  delete core.targetLabel;
  const parsed = parseMutationOperation(core);
  if (parsed.type === "todo.create" || parsed.type === "cyclePlan.create") {
    if (expectedUpdatedAt !== undefined || targetLabel !== undefined) {
      throw new Error("新增操作不能包含目标版本元数据");
    }
    return parsed;
  }
  const version = readTimestamp(expectedUpdatedAt);
  const label = targetLabel === undefined ? undefined : readText(targetLabel, "targetLabel", 500);
  return { ...parsed, expectedUpdatedAt: version, ...(label ? { targetLabel: label } : {}) };
}

function readText(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== "string") throw new Error(`${label}必须是字符串`);
  const text = value.trim();
  if (!text) throw new Error(`${label}不能为空`);
  if (text.length > maxLength) throw new Error(`${label}过长`);
  return text;
}

function readTimestamp(value: unknown): string {
  const timestamp = readText(value, "expectedUpdatedAt", 100);
  if (Number.isNaN(Date.parse(timestamp))) throw new Error("expectedUpdatedAt 格式无效");
  return timestamp;
}
