/**
 * 模块用途：管理会话级 AI Flow，并把纯状态转换连接到安全 preload API。
 * 模块边界：不解释或直接修改提案操作，不持久化聊天记录。
 */
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { AiConversationTurn } from "../../../shared/aiMutationTypes";
import { getAiDesktopBridge } from "./aiBridge";
import {
  getAiLaunchPresentation,
  toAiGenerationContext,
  type AiPlannerLaunchContext
} from "./aiPlannerLaunchContext";
import { createAiPlannerState, reduceAiPlannerState } from "./aiPlannerState";
import { useAiConfigController } from "./useAiConfigController";

interface UseAiPlannerOptions {
  onStateApplied(state: { todos: unknown[]; cyclePlans: unknown[] }): void;
}

export type AiPlannerBusyOperation = "generating" | "executing" | "discarding" | null;

export function useAiPlanner(options: UseAiPlannerOptions) {
  const bridge = useMemo(getAiDesktopBridge, []);
  const configController = useAiConfigController(bridge);
  const [state, dispatch] = useReducer(reduceAiPlannerState, undefined, createAiPlannerState);
  const [launchContext, setLaunchContext] = useState<AiPlannerLaunchContext>({
    type: "cyclePlan.create"
  });
  const [busy, setBusy] = useState(false);
  const [busyOperation, setBusyOperation] = useState<AiPlannerBusyOperation>(null);
  const [error, setError] = useState<string | null>(null);
  const requestEpoch = useRef(0);
  const requestSequence = useRef(0);
  const sessionId = useRef(createAiToken("session"));

  useEffect(() => {
    if (!configController.draft.initialized) return;
    dispatch({
      type: "screen.open",
      screen: configController.config?.configured ? "conversation" : "config"
    });
  }, [configController.config?.configured, configController.draft.initialized]);

  const saveConfig = useCallback(async () => {
    if (await configController.save()) {
      dispatch({ type: "screen.open", screen: "conversation" });
    }
  }, [configController]);

  const saveConfigAndStay = useCallback(async () => {
    await configController.save();
  }, [configController]);

  const requestProposal = useCallback(async (
    message: string,
    conversation: AiConversationTurn[],
    epoch: number
  ) => {
    const response = await bridge.generate({
      sessionId: sessionId.current,
      requestId: `${sessionId.current}_request_${requestSequence.current += 1}`,
      message,
      conversation,
      context: toAiGenerationContext(launchContext),
      ...(state.proposal ? { supersedesProposalId: state.proposal.proposalId } : {})
    });
    if (epoch !== requestEpoch.current) {
      if (response.status === "proposal") {
        void bridge.discard(response.proposal.proposalId).catch(() => undefined);
      }
      return;
    }
    if (response.status === "message") {
      dispatch({ type: "conversation.assistant-added", message: response.message });
    } else {
      dispatch({ type: "proposal.generated", proposal: response.proposal });
    }
  }, [bridge, launchContext, state.proposal]);

  const sendMessage = useCallback(async (message: string) => {
    const nextMessage = message.trim();
    if (!nextMessage || busy) return;
    const conversation = state.conversation;
    const epoch = requestEpoch.current;
    dispatch({ type: "conversation.user-added", message: nextMessage });
    setBusy(true); setBusyOperation("generating"); setError(null);
    try { await requestProposal(nextMessage, conversation, epoch); }
    catch (reason) {
      if (epoch === requestEpoch.current) setError(readError(reason));
    } finally {
      if (epoch === requestEpoch.current) {
        setBusy(false);
        setBusyOperation(null);
      }
    }
  }, [busy, requestProposal, state.conversation]);

  const executeProposal = useCallback(async () => {
    if (!state.proposal || state.proposalPhase !== "pending") return;
    setBusy(true); setBusyOperation("executing"); setError(null);
    try {
      const result = await bridge.execute(state.proposal.proposalId);
      dispatch({ type: "execution.finished", result });
      if (result.status === "success") options.onStateApplied(result.state);
    } catch (reason) { setError(readError(reason)); }
    finally { setBusy(false); setBusyOperation(null); }
  }, [bridge, options, state.proposal, state.proposalPhase]);

  const discardProposal = useCallback(async () => {
    if (!state.proposal) return true;
    setBusy(true); setBusyOperation("discarding"); setError(null);
    try {
      await bridge.discard(state.proposal.proposalId);
      dispatch({ type: "proposal.discarded" });
      return true;
    } catch (reason) {
      setError(readError(reason));
      return false;
    }
    finally { setBusy(false); setBusyOperation(null); }
  }, [bridge, state.proposal]);

  const regenerate = useCallback(async () => {
    if (!state.lastInstruction) {
      dispatch({ type: "screen.open", screen: "conversation" });
      setError("没有可重新生成的上一条指令");
      return;
    }
    const epoch = requestEpoch.current;
    setBusy(true); setBusyOperation("generating"); setError(null);
    try {
      await requestProposal(
        state.lastInstruction,
        removeLastMatchingInstruction(state.conversation, state.lastInstruction),
        epoch
      );
    } catch (reason) {
      if (epoch === requestEpoch.current) setError(readError(reason));
    } finally {
      if (epoch === requestEpoch.current) {
        setBusy(false);
        setBusyOperation(null);
      }
    }
  }, [requestProposal, state.conversation, state.lastInstruction]);

  function start(context: AiPlannerLaunchContext) {
    const previousProposalId = state.proposal?.proposalId;
    requestEpoch.current += 1;
    requestSequence.current = 0;
    sessionId.current = createAiToken("session");
    setBusy(false);
    setBusyOperation(null);
    setLaunchContext(context);
    setError(null);
    dispatch({
      type: "flow.started",
      screen: configController.config?.configured ? "conversation" : "config",
      composerDraft: getAiLaunchPresentation(context).composerSeed
    });
    if (previousProposalId) {
      void bridge.discard(previousProposalId).catch(() => undefined);
    }
  }

  return {
    ...state,
    busy: busy || configController.busy,
    busyOperation,
    config: configController.config,
    configConnection: configController.draft.connection,
    configDraft: configController.draft.fields,
    error: error ?? configController.error,
    launchContext,
    launchPresentation: getAiLaunchPresentation(launchContext),
    changeConfigField: configController.changeField,
    changeComposerDraft: (message: string) => dispatch({ type: "composer.changed", message }),
    consumeResumeConfig: configController.consumeResumeConfig,
    discardProposal,
    executeProposal,
    regenerate,
    resume: (context: AiPlannerLaunchContext) => setLaunchContext(context),
    start,
    openConfig: () => dispatch({ type: "screen.open", screen: "config" }),
    openConversation: () => dispatch({
      type: "screen.open",
      screen: configController.config?.configured ? "conversation" : "config"
    }),
    openProposal: () => state.proposal && dispatch({ type: "screen.open", screen: "proposal" }),
    resumeConfigRequested: configController.resumeConfigRequested,
    saveConfig, saveConfigAndStay, sendMessage, testConnection: configController.test
  };
}

export type AiPlannerController = ReturnType<typeof useAiPlanner>;

function removeLastMatchingInstruction(
  conversation: AiConversationTurn[],
  instruction: string
): AiConversationTurn[] {
  for (let index = conversation.length - 1; index >= 0; index -= 1) {
    const turn = conversation[index];
    if (turn.role === "user" && turn.content === instruction) {
      return conversation.filter((_, turnIndex) => turnIndex !== index);
    }
  }
  return conversation;
}

function readError(value: unknown): string {
  return value instanceof Error ? value.message : "操作失败，请重试";
}

function createAiToken(prefix: string): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return `${prefix}_${uuid ?? `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;
}
