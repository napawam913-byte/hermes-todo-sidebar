/**
 * 模块用途：把周期计划纯函数和 React 状态连接起来，供今日页和计划页共用。
 * 模块边界：只管理前端周期计划状态，不做 Hermes 同步或 AI 生成。
 */
// [待删除-2026-07-15]
// 原用途：由 renderer store 直接保存周期计划数组。
// 替代方案：AppMutationGateway + useAppMutationStore 统一执行计划与条目操作。
// 删除条件：用户确认 0.1.3-test.4 周期计划 CRUD 与重启持久化稳定后再请求许可。
import { useCallback, useState } from "react";
import { upsertCyclePlan } from "./cyclePlanDraft";
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
  hydratePlans(plans: CyclePlan[]): void;
  upsertPlan(plan: CyclePlan): void;
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

  const savePlan = useCallback(
    (plan: CyclePlan) => {
      setCyclePlans((currentPlans) => {
        const updatedPlans = upsertCyclePlan(currentPlans, plan);
        repository.savePlans(updatedPlans);
        return updatedPlans;
      });
    },
    [repository]
  );

  const hydratePlans = useCallback((plans: CyclePlan[]) => {
    setCyclePlans(plans);
  }, []);

  return {
    cyclePlans,
    completeEntry,
    hydratePlans,
    upsertPlan: savePlan
  };
}
