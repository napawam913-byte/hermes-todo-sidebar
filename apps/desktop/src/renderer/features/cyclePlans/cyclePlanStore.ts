/**
 * 模块用途：把周期计划纯函数和 React 状态连接起来，供今日页和计划页共用。
 * 模块边界：只管理前端周期计划状态，不做 Hermes 同步或 AI 生成。
 */
import { useCallback, useState } from "react";
import { completeCyclePlanEntry } from "./cyclePlanModel";
import type { CyclePlanRepository } from "./cyclePlanRepository";
import type { CyclePlan, CyclePlanEntry } from "./cyclePlanTypes";

interface UseCyclePlanStoreOptions {
  repository: CyclePlanRepository;
  initialPlans: CyclePlan[];
}

interface CyclePlanStoreState {
  cyclePlans: CyclePlan[];
  completeEntry(entryId: string): CyclePlanEntry | undefined;
}

function loadInitialPlans(repository: CyclePlanRepository, fallbackPlans: CyclePlan[]) {
  const persistedPlans = repository.loadPlans();
  return persistedPlans.length > 0 ? persistedPlans : fallbackPlans;
}

export function useCyclePlanStore(options: UseCyclePlanStoreOptions): CyclePlanStoreState {
  const { initialPlans, repository } = options;
  const [cyclePlans, setCyclePlans] = useState<CyclePlan[]>(() => loadInitialPlans(repository, initialPlans));

  const completeEntry = useCallback(
    (entryId: string) => {
      let completedEntry: CyclePlanEntry | undefined;

      setCyclePlans((currentPlans) => {
        const result = completeCyclePlanEntry(currentPlans, entryId, new Date());
        completedEntry = result.entry;
        repository.savePlans(result.plans);
        return result.plans;
      });

      return completedEntry;
    },
    [repository]
  );

  return {
    cyclePlans,
    completeEntry
  };
}
