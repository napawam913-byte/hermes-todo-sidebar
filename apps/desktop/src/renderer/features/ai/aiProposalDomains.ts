/** 模块用途：从提案操作中识别执行结果对应的顶层数据页面。 */
import type { AiMutationOperation } from "../../../shared/aiMutationTypes";

export interface AiProposalDomains {
  today: boolean;
  cycle: boolean;
}

export function getProposalDomains(
  operations: AiMutationOperation[]
): AiProposalDomains {
  return operations.reduce<AiProposalDomains>((domains, operation) => ({
    today: domains.today || operation.type.startsWith("todo."),
    cycle: domains.cycle || operation.type.startsWith("cyclePlan.")
  }), { today: false, cycle: false });
}
