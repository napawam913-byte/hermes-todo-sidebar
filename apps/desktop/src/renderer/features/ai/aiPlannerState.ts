/**
 * 模块用途：定义 AI Flow 的纯会话状态与可测试转换。
 * 模块边界：不发起 IPC，不保存持久化数据，也不依赖 React。
 */
import type {
  AiConversationTurn,
  AiExecuteResult,
  AiMutationProposal
} from "../../../shared/aiMutationTypes";

export type AiPlannerScreen = "config" | "conversation" | "proposal" | "result";
export type AiProposalPhase = "pending" | "success" | "failed";

export interface AiPlannerState {
  screen: AiPlannerScreen;
  conversation: AiConversationTurn[];
  proposal: AiMutationProposal | null;
  proposalPhase: AiProposalPhase | null;
  result: AiExecuteResult | null;
  lastInstruction: string;
  composerDraft: string;
}

export type AiPlannerAction =
  | { type: "flow.started"; screen: "config" | "conversation"; composerDraft?: string }
  | { type: "screen.open"; screen: AiPlannerScreen }
  | { type: "composer.changed"; message: string }
  | { type: "conversation.user-added"; message: string }
  | { type: "conversation.assistant-added"; message: string }
  | { type: "proposal.generated"; proposal: AiMutationProposal }
  | { type: "proposal.discarded" }
  | { type: "execution.finished"; result: AiExecuteResult };

export function createAiPlannerState(): AiPlannerState {
  return {
    screen: "config",
    conversation: [],
    proposal: null,
    proposalPhase: null,
    result: null,
    lastInstruction: "",
    composerDraft: ""
  };
}

export function isRetryableExecutionResult(result: AiExecuteResult): boolean {
  return result.status === "failed" && result.code === "persistence_failed";
}

export function reduceAiPlannerState(
  state: AiPlannerState,
  action: AiPlannerAction
): AiPlannerState {
  if (action.type === "flow.started") {
    return {
      ...createAiPlannerState(),
      screen: action.screen,
      composerDraft: action.composerDraft ?? ""
    };
  }
  if (action.type === "screen.open") return { ...state, screen: action.screen };
  if (action.type === "composer.changed") {
    return { ...state, composerDraft: action.message };
  }
  if (action.type === "conversation.user-added") {
    return {
      ...state,
      lastInstruction: action.message,
      composerDraft: "",
      conversation: [...state.conversation, { role: "user", content: action.message }]
    };
  }
  if (action.type === "conversation.assistant-added") {
    return {
      ...state,
      screen: "conversation",
      conversation: [...state.conversation, { role: "assistant", content: action.message }]
    };
  }
  if (action.type === "proposal.generated") {
    return {
      ...state,
      screen: "proposal",
      proposal: action.proposal,
      proposalPhase: "pending",
      result: null,
      conversation: [
        ...state.conversation,
        { role: "assistant", content: action.proposal.summary }
      ]
    };
  }
  if (action.type === "proposal.discarded") {
    return {
      ...state,
      screen: "conversation",
      proposal: null,
      proposalPhase: null,
      result: null
    };
  }
  return {
    ...state,
    screen: "result",
    result: action.result,
    proposalPhase: action.result.status === "success"
      ? "success"
      : isRetryableExecutionResult(action.result) ? "pending" : "failed"
  };
}
