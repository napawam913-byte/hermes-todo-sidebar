/**
 * 模块用途：待办面板容器，组织标题栏、主导航、今日待办和周期任务视图。
 * 模块边界：只编排顶层 UI，不直接生成周期任务或调用 Hermes。
 */
import { useEffect, useReducer, useRef, useState } from "react";
import type { ManualMutationHandler } from "../../data/manualMutation";
import { AiPlannerView } from "../ai/AiPlannerView";
import { AiContextSwitchConfirm } from "../ai/AiContextSwitchConfirm";
import {
  isSameAiLaunchContext,
  type AiPlannerLaunchContext
} from "../ai/aiPlannerLaunchContext";
import { useAiPlanner } from "../ai/useAiPlanner";
import { SettingsPanel } from "../settings/SettingsPanel";
import type { CharacterPack } from "../sidebar/characterPack";
import { CyclePlanView } from "../cyclePlans/CyclePlanView";
import type { CyclePlan } from "../cyclePlans/cyclePlanTypes";
import { usePetActivity } from "../sidebar/PetActivityContext";
import {
  createPanelSessionState,
  getPanelMode,
  reducePanelSessionState
} from "../sidebar/panelSessionState";
import { TodayTodoView } from "./TodayTodoView";
import { TodoPanelHeader } from "./TodoPanelHeader";
import { TopModeTabs } from "./TopModeTabs";
import type { Todo } from "./types";

interface TodoPanelProps {
  characterId: string;
  characters: CharacterPack[];
  todos: Todo[];
  cyclePlans: CyclePlan[];
  collapseVersion: number;
  mutationBusy: boolean;
  mutationError: string | null;
  todayKey: string;
  onAiStateApplied(state: { todos: unknown[]; cyclePlans: unknown[] }): void;
  onCharacterChange(characterId: string): void;
  onDismissMutationError(): void;
  onManualMutate: ManualMutationHandler;
  onPanelOpacityChange: (value: number) => void;
  panelOpacity: number;
}

export function TodoPanel(props: TodoPanelProps) {
  const [session, dispatchSession] = useReducer(
    reducePanelSessionState,
    undefined,
    createPanelSessionState
  );
  const previousCollapseVersion = useRef(props.collapseVersion);
  const [pendingAiContext, setPendingAiContext] = useState<AiPlannerLaunchContext | null>(null);
  const planner = useAiPlanner({ onStateApplied: props.onAiStateApplied });
  const activeMode = getPanelMode(session);
  const { beginThinking, beginWaiting, beginWorking, fail } = usePetActivity();
  const previousFailure = useRef<string | null>(null);

  useEffect(() => {
    if (previousCollapseVersion.current === props.collapseVersion) return;
    previousCollapseVersion.current = props.collapseVersion;
    dispatchSession({ type: "panel.collapsed" });
  }, [props.collapseVersion]);

  useEffect(() => {
    if (planner.busyOperation === "generating") return beginThinking();
    if (planner.busyOperation === "executing") return beginWorking();
  }, [beginThinking, beginWorking, planner.busyOperation]);

  useEffect(() => {
    const waiting = session.surface === "ai"
      && !planner.busy
      && (planner.screen === "conversation" || planner.screen === "proposal")
      && (planner.proposalPhase === "pending"
        || planner.conversation.at(-1)?.role === "assistant");
    if (waiting) return beginWaiting();
  }, [
    beginWaiting,
    planner.busy,
    planner.conversation,
    planner.proposalPhase,
    planner.screen,
    session.surface
  ]);

  useEffect(() => {
    const failure = planner.error
      ?? (planner.result?.status === "failed"
        ? `${planner.result.code}:${planner.result.message}`
        : null);
    if (failure && failure !== previousFailure.current) fail();
    previousFailure.current = failure;
  }, [fail, planner.error, planner.result]);

  useEffect(() => {
    if (!planner.resumeConfigRequested) return;
    dispatchSession({ type: "settings.opened" });
    dispatchSession({ type: "settings.section-selected", section: "model" });
    planner.consumeResumeConfig();
  }, [planner.resumeConfigRequested]);

  useEffect(() => {
    setPendingAiContext(null);
  }, [session.interactionResetVersion]);

  return (
    <div className="todo-panel">
      <TodoPanelHeader
        settingsOpen={session.surface === "settings"}
        onCloseSettings={() => dispatchSession({ type: "settings.closed" })}
        onOpenSettings={() => dispatchSession({ type: "settings.opened" })}
      />

      {props.mutationError ? (
        <div className="mutation-error" role="alert">
          <div><strong>保存失败</strong><span>{props.mutationError}</span></div>
          <button type="button" onClick={props.onDismissMutationError}>关闭</button>
        </div>
      ) : null}

      {session.surface !== "settings" ? (
        <TopModeTabs
          activeMode={activeMode}
          onModeChange={(mode) => dispatchSession({ type: "mode.selected", mode })}
        />
      ) : null}

      <section className="panel-surface" hidden={session.surface !== "settings"}>
        <SettingsPanel
          characterId={props.characterId}
          characters={props.characters}
          panelOpacity={props.panelOpacity}
          planner={planner}
          section={session.settingsSection}
          onCharacterChange={props.onCharacterChange}
          onPanelOpacityChange={props.onPanelOpacityChange}
          onSectionChange={(section) => dispatchSession({
            type: "settings.section-selected",
            section
          })}
        />
      </section>

      <section className="panel-surface" hidden={session.surface !== "today"}>
        <TodayTodoView
          busy={props.mutationBusy}
          todos={props.todos}
          cyclePlans={props.cyclePlans}
          dateKey={props.todayKey}
          interactionResetVersion={session.interactionResetVersion}
          onMutate={props.onManualMutate}
        />
      </section>

      <section className="panel-surface" hidden={session.surface !== "cycle"}>
        <div className="cycle-panel-surface" hidden={pendingAiContext !== null}>
          <CyclePlanView
            busy={props.mutationBusy}
            interactionResetVersion={session.interactionResetVersion}
            plans={props.cyclePlans}
            todayKey={props.todayKey}
            onAiOpen={openAiContext}
            onMutate={props.onManualMutate}
          />
        </div>
        {pendingAiContext ? (
          <AiContextSwitchConfirm
            busy={planner.busy}
            nextContext={pendingAiContext}
            onContinueCurrent={() => {
              setPendingAiContext(null);
              dispatchSession({ type: "surface.opened", surface: "ai" });
            }}
            onDiscardAndSwitch={() => void discardAndSwitchAiContext()}
          />
        ) : null}
      </section>

      <section className="panel-surface" hidden={session.surface !== "ai"}>
        <AiPlannerView
          planner={planner}
          onClose={() => dispatchSession({ type: "mode.selected", mode: "cycle" })}
          onNavigate={(mode) => dispatchSession({ type: "mode.selected", mode })}
        />
      </section>
    </div>
  );

  function openAiContext(context: AiPlannerLaunchContext) {
    if (isSameAiLaunchContext(planner.launchContext, context)) {
      planner.resume(context);
      dispatchSession({ type: "surface.opened", surface: "ai" });
      return;
    }
    if (planner.proposal && planner.proposalPhase === "pending") {
      setPendingAiContext(context);
      return;
    }
    planner.start(context);
    dispatchSession({ type: "surface.opened", surface: "ai" });
  }

  async function discardAndSwitchAiContext() {
    if (!pendingAiContext || !await planner.discardProposal()) return;
    const nextContext = pendingAiContext;
    setPendingAiContext(null);
    planner.start(nextContext);
    dispatchSession({ type: "surface.opened", surface: "ai" });
  }
}
