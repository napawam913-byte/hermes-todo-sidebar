/**
 * 模块用途：把已确认提案放入应用状态事务队列并只保存一次。
 * 模块边界：不生成提案、不调用模型，也不暴露文件系统给 renderer。
 */
import type { AiMutationProposal } from "../../shared/aiMutationTypes.js";
import type { StoredAppStateV1 } from "../storage/appStateTypes.js";
import { AppMutationExecutor } from "../storage/appMutationExecutor.js";
import type { AppStateService } from "../storage/appStateService.js";

interface ExecutorOptions {
  now?: () => Date;
  idFactory?: (prefix: string) => string;
}

export class AiProposalExecutor {
  private readonly executor: AppMutationExecutor;

  constructor(
    private readonly stateService: AppStateService,
    options: ExecutorOptions = {}
  ) {
    this.executor = new AppMutationExecutor(stateService, options);
  }

  async execute(proposal: AiMutationProposal): Promise<StoredAppStateV1> {
    return this.executor.execute({
      source: { type: "ai_draft", proposalId: proposal.proposalId },
      summary: proposal.summary,
      operations: proposal.operations
    });
  }
}
