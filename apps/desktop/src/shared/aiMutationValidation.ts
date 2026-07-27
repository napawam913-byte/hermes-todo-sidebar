/**
 * 模块用途：校验模型返回的 AiMutationProposal v1 外层结构和批次限制。
 * 模块边界：不补全 ID、时间戳或冲突版本，这些属于主进程提案服务。
 */
import { AI_MUTATION_SCHEMA_VERSION, type ModelMutationProposal } from "./aiMutationTypes.js";
import { asRecord, exactKeys, parseMutationOperation } from "./aiOperationValidation.js";

export function parseModelMutationProposal(value: unknown): ModelMutationProposal {
  const proposal = normalizeProposalVersion(asRecord(value, "AI 提案必须是对象"));
  exactKeys(proposal, ["schemaVersion", "summary", "operations"]);
  if (proposal.schemaVersion !== AI_MUTATION_SCHEMA_VERSION) {
    throw new Error("不支持的 AI 提案版本");
  }
  if (typeof proposal.summary !== "string" || !proposal.summary.trim()) {
    throw new Error("提案摘要不能为空");
  }
  if (!Array.isArray(proposal.operations)) {
    throw new Error("operations 必须是数组");
  }
  if (proposal.operations.length > 50) {
    throw new Error("单批提案最多允许 50 项操作");
  }
  return {
    schemaVersion: AI_MUTATION_SCHEMA_VERSION,
    summary: proposal.summary.trim(),
    operations: proposal.operations.map(parseMutationOperation)
  };
}

function normalizeProposalVersion(proposal: Record<string, unknown>): Record<string, unknown> {
  if (!("version" in proposal) || "schemaVersion" in proposal) return proposal;
  exactKeys(proposal, ["version", "summary", "operations"]);
  if (!isVersionOne(proposal.version)) throw new Error("不支持的 AI 提案版本");
  const { version: _version, ...canonical } = proposal;
  return { ...canonical, schemaVersion: AI_MUTATION_SCHEMA_VERSION };
}

function isVersionOne(value: unknown): boolean {
  return value === 1 || (typeof value === "string" && /^(?:v?1|1\.0)$/i.test(value.trim()));
}
