/**
 * 模块用途：把已确认提案原样委托给共享 Plan API 变更端口。
 * 模块边界：不生成提案、不调用模型，也不在本地生成 ID 或状态副本。
 */
import type { AiMutationProposal } from "../../shared/aiMutationTypes.js";
import type { StoredAppStateV1 } from "../storage/appStateTypes.js";
import type { AiMutationPort } from "./aiDataPorts.js";

export class AiProposalExecutor {
  constructor(private readonly mutationPort: AiMutationPort) {}

  async execute(proposal: AiMutationProposal): Promise<StoredAppStateV1> {
    return this.mutationPort.execute({
      source: { type: "ai_draft", proposalId: proposal.proposalId },
      summary: proposal.summary,
      operations: proposal.operations
    });
  }
}
