/**
 * 模块用途：锁定 AI Flow 在对话、提案和执行结果之间切换时的会话保留规则。
 * 模块边界：只测试纯状态转换，不调用 React、Electron 或模型网络。
 */
import { describe, expect, it } from "vitest";
import type { AiMutationProposal } from "../../../shared/aiMutationTypes";
import { createAiPlannerState, reduceAiPlannerState } from "./aiPlannerState";

const proposal: AiMutationProposal = {
  schemaVersion: 1,
  proposalId: "proposal_1",
  summary: "调整训练计划",
  operations: [{ type: "todo.create", draft: { title: "训练", date: "2026-07-15" } }]
};

describe("AI Flow 状态模型", () => {
  it("返回对话和自然语言回复不会清除当前提案", () => {
    const withProposal = reduceAiPlannerState(createAiPlannerState(), {
      type: "proposal.generated",
      proposal
    });
    const inConversation = reduceAiPlannerState(withProposal, {
      type: "screen.open",
      screen: "conversation"
    });
    const replied = reduceAiPlannerState(inConversation, {
      type: "conversation.assistant-added",
      message: "你希望安排几天？"
    });

    expect(replied.proposal).toEqual(proposal);
    expect(replied.proposalPhase).toBe("pending");
    expect(replied.screen).toBe("conversation");
  });

  it("执行失败保留只读提案，显式放弃才清空", () => {
    const withProposal = reduceAiPlannerState(createAiPlannerState(), {
      type: "proposal.generated",
      proposal
    });
    const failed = reduceAiPlannerState(withProposal, {
      type: "execution.finished",
      result: { status: "failed", code: "version_conflict", message: "数据已变化" }
    });

    expect(failed.proposalPhase).toBe("failed");
    expect(failed.proposal).toEqual(proposal);
    expect(reduceAiPlannerState(failed, { type: "proposal.discarded" }).proposal).toBeNull();
  });

  it("开始另一周期任务流程时清除旧会话和提案", () => {
    const withProposal = reduceAiPlannerState(createAiPlannerState(), {
      type: "proposal.generated",
      proposal
    });
    const restarted = reduceAiPlannerState(withProposal, {
      type: "flow.started",
      screen: "conversation"
    });

    expect(restarted.screen).toBe("conversation");
    expect(restarted.conversation).toEqual([]);
    expect(restarted.proposal).toBeNull();
    expect(restarted.result).toBeNull();
    expect(restarted.lastInstruction).toBe("");
  });
});
