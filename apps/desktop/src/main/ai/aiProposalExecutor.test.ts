/**
 * 模块用途：验证 AI 确认只把原提案转换为一个 Plan API 变更批次。
 * 模块边界：不执行本地事务，不生成领域 ID、时间戳或任务副本。
 */
import { describe, expect, it, vi } from "vitest";
import type { AiMutationProposal } from "../../shared/aiMutationTypes.js";
import {
  createEmptyAppState,
  type StoredAppStateV1
} from "../storage/appStateTypes.js";
import { PlanApiError } from "../planApi/planApiErrors.js";
import { AiProposalExecutor } from "./aiProposalExecutor.js";

const proposal: AiMutationProposal = {
  schemaVersion: 1,
  proposalId: "proposal_1",
  summary: "调整健身计划",
  operations: [{
    type: "cyclePlan.create",
    draft: {
      title: "四周健身计划",
      topic: "健身",
      description: "每周三练",
      entries: []
    }
  }]
};

function refreshedState(): StoredAppStateV1 {
  return {
    ...createEmptyAppState(new Date("2026-07-28T08:00:00.000Z")),
    cyclePlans: [{ id: "plan_remote" }]
  };
}

describe("AiProposalExecutor", () => {
  it("delegates the exact proposal batch once and returns the refreshed snapshot", async () => {
    const state = refreshedState();
    const execute = vi.fn(async () => state);
    const executor = new AiProposalExecutor({ execute });

    await expect(executor.execute(proposal)).resolves.toBe(state);
    expect(execute).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledWith({
      source: { type: "ai_draft", proposalId: "proposal_1" },
      summary: proposal.summary,
      operations: proposal.operations
    });
    expect(execute.mock.calls[0][0].operations).toBe(proposal.operations);
  });

  it("does not retry a failed Plan API mutation", async () => {
    const execute = vi.fn(async () => {
      throw new PlanApiError("offline");
    });
    const executor = new AiProposalExecutor({ execute });

    await expect(executor.execute(proposal)).rejects.toMatchObject({
      code: "offline"
    });
    expect(execute).toHaveBeenCalledOnce();
  });
});
