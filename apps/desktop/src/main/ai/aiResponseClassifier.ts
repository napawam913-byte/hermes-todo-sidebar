/**
 * 模块用途：把 Hermes 最终文本分类为普通聊天消息或严格的模型变更提案。
 * 模块边界：只解析最终文本，不补充提案 ID、不检查本地目标，也不执行操作。
 */
import type { ModelMutationProposal } from "../../shared/aiMutationTypes.js";
import { parseModelMutationProposal } from "../../shared/aiMutationValidation.js";

export type ClassifiedAiResponse =
  | { status: "message"; message: string }
  | { status: "proposal"; proposal: ModelMutationProposal };

const PROPOSAL_TEXT_MARKERS = [
  '"schemaVersion"',
  '"version"',
  '"operations"',
  '"cyclePlan.create"',
  '"cyclePlan.update"'
];

export function classifyAiAssistantResponse(content: string): ClassifiedAiResponse {
  const trimmed = content.trim();
  if (!trimmed) throw new Error("模型回复为空");

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    if (looksLikeProposalText(trimmed)) throw proposalFormatError(error);
    return { status: "message", message: trimmed };
  }

  if (!looksLikeProposalValue(parsed)) {
    return { status: "message", message: trimmed };
  }
  try {
    return { status: "proposal", proposal: parseModelMutationProposal(parsed) };
  } catch (error) {
    throw proposalFormatError(error);
  }
}

function looksLikeProposalText(value: string): boolean {
  return PROPOSAL_TEXT_MARKERS.some((marker) => value.includes(marker));
}

function looksLikeProposalValue(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return "schemaVersion" in record || "version" in record || "operations" in record;
}

function proposalFormatError(error: unknown): Error {
  const detail = error instanceof Error ? error.message : "未知格式错误";
  return new Error(`AI 周期计划提案格式无效：${detail}`);
}
