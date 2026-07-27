/**
 * 模块用途：组合面板壳层、今日待办、周期任务和本地持久化状态。
 * 模块边界：只管理前端原型状态，不直接访问 Electron 主进程实现细节。
 */
import { useCallback, useMemo, useState } from "react";
import {
  normalizeAppSnapshot,
  type AppDataBootstrapResult
} from "./data/appDataBootstrap";
import { OFFLINE_MUTATION_MESSAGE } from "./data/appMutationGateway";
import type { ManualMutationHandler } from "./data/manualMutation";
import { useAppMutationStore } from "./data/useAppMutationStore";
import { usePlanApiDataService } from "./data/usePlanApiDataService";
import { useAppearanceSettings } from "./features/appearance/useAppearanceSettings";
import { usePetActivity } from "./features/sidebar/PetActivityContext";
import { usePetReminderSignals } from "./features/sidebar/usePetReminderSignals";
import { SidebarShell } from "./features/sidebar/SidebarShell";
import { characterRegistry } from "./features/sidebar/builtInCharacterRegistry";
import { shouldCelebrateOperations } from "./features/sidebar/petVisualState";
import { TodoPanel } from "./features/todos/TodoPanel";
import { buildTodayItems } from "./features/todos/todayItems";
import { useLocalDateKey } from "./features/todos/useLocalDateKey";

interface AppProps {
  appData: AppDataBootstrapResult;
}

export function App({ appData }: AppProps) {
  // [待删除-2026-07-17] 旧版 detailResetVersion 会销毁工作页；现在只通知子页清理瞬时交互。
  const [collapseVersion, setCollapseVersion] = useState(0);
  const [expanded, setExpanded] = useState(appData.startExpanded);
  const appearance = useAppearanceSettings();
  const characterPack = characterRegistry.resolve(appearance.characterId);
  const characters = characterRegistry.list();
  const todayKey = useLocalDateKey();
  const { beginWorking, celebrate, fail, remind } = usePetActivity();
  const mutation = useAppMutationStore({
    gateway: appData.mutationGateway,
    initialState: {
      todos: appData.initialTodos,
      cyclePlans: appData.initialCyclePlans
    }
  });
  const hydrateExternalSnapshot = useCallback((todos: unknown[], cyclePlans: unknown[]) => {
    mutation.hydrate(normalizeAppSnapshot(todos, cyclePlans));
  }, [mutation.hydrate]);
  const dataService = usePlanApiDataService({
    bridge: appData.planApiBridge,
    initialStatus: appData.initialDataStatus,
    onSnapshot: hydrateExternalSnapshot
  });
  const { todos, cyclePlans } = mutation.snapshot;

  const attentionItems = useMemo(
    () => buildTodayItems({ todos, cyclePlans, dateKey: todayKey })
      .filter((item) => item.status === "pending"),
    [cyclePlans, todayKey, todos]
  );
  const activeCount = attentionItems.length;
  usePetReminderSignals({
    attentionIds: attentionItems.map((item) => `${item.kind}:${item.id}`),
    dateKey: todayKey,
    expanded,
    onRemind: remind
  });

  const handleManualMutation = useCallback<ManualMutationHandler>(
    async (summary, operations) => {
      if (!dataService.status.canMutate) {
        mutation.reportError(OFFLINE_MUTATION_MESSAGE);
        return false;
      }
      const finishWorking = beginWorking();
      try {
        const saved = await mutation.execute({ source: { type: "manual" }, summary, operations });
        if (saved && shouldCelebrateOperations(operations)) celebrate();
        if (!saved) fail();
        return saved;
      } finally {
        finishWorking();
      }
    },
    [
      beginWorking, celebrate, dataService.status.canMutate, fail,
      mutation.execute, mutation.reportError
    ]
  );

  function handleExpandedChange(nextExpanded: boolean) {
    setExpanded(nextExpanded);
    if (!nextExpanded) {
      setCollapseVersion((version) => version + 1);
    }
  }

  function handleAiStateApplied(state: { todos: unknown[]; cyclePlans: unknown[] }) {
    hydrateExternalSnapshot(state.todos, state.cyclePlans);
    celebrate();
  }

  return (
    <SidebarShell
      activeCount={activeCount}
      characterPack={characterPack}
      expanded={expanded}
      panelOpacity={appearance.panelOpacity}
      onExpandedChange={handleExpandedChange}
    >
      <TodoPanel
        browserPreview={appData.planApiBridge === null}
        characterId={characterPack.manifest.id}
        characters={characters}
        collapseVersion={collapseVersion}
        cyclePlans={cyclePlans}
        dataService={dataService}
        mutationBusy={mutation.busy}
        mutationError={mutation.error}
        readOnly={!dataService.status.canMutate}
        todayKey={todayKey}
        todos={todos}
        onAiStateApplied={handleAiStateApplied}
        onCharacterChange={appearance.setCharacterId}
        onDismissMutationError={mutation.clearError}
        onManualMutate={handleManualMutation}
        onPanelOpacityChange={appearance.setPanelOpacity}
        panelOpacity={appearance.panelOpacity}
      />
    </SidebarShell>
  );
}
