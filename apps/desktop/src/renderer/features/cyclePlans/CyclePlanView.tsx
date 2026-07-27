/**
 * 模块用途：协调周期任务主列表与同面板详情。
 * 模块边界：只管理计划选择，不直接调用模型或构造 Mutation。
 */
import { useMemo, useState } from "react";
import { ResponsiveMasterDetail } from "../../components/ResponsiveMasterDetail";
import type { ManualMutationHandler } from "../../data/manualMutation";
import type { AiPlannerLaunchContext } from "../ai/aiPlannerLaunchContext";
import { CyclePlanDrawer } from "./CyclePlanDrawer";
import { CyclePlanListPane } from "./CyclePlanListPane";
import type { CyclePlan } from "./cyclePlanTypes";

interface CyclePlanViewProps {
  busy: boolean;
  readOnly: boolean;
  interactionResetVersion: number;
  plans: CyclePlan[];
  todayKey: string;
  onAiOpen: (context: AiPlannerLaunchContext) => void;
  onMutate: ManualMutationHandler;
}

export function CyclePlanView(props: CyclePlanViewProps) {
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const selectedPlan = useMemo(
    () => props.plans.find((plan) => plan.id === selectedPlanId),
    [props.plans, selectedPlanId]
  );
  const writeBusy = props.busy || props.readOnly;
  const master = (
    <CyclePlanListPane
      busy={writeBusy}
      plans={props.plans}
      selectedPlanId={selectedPlanId}
      todayKey={props.todayKey}
      onAiCreate={() => props.onAiOpen({ type: "cyclePlan.create" })}
      onOpen={(plan) => setSelectedPlanId(plan.id)}
    />
  );
  const detail = selectedPlan ? (
    <CyclePlanDrawer
      busy={writeBusy}
      interactionResetVersion={props.interactionResetVersion}
      key={selectedPlan.id}
      plan={selectedPlan}
      todayKey={props.todayKey}
      onClose={() => setSelectedPlanId(null)}
      onAiAdjust={() => openAiAdjust(selectedPlan)}
      onMutate={props.onMutate}
    />
  ) : undefined;

  return <ResponsiveMasterDetail master={master} detail={detail} />;

  function openAiAdjust(plan: CyclePlan) {
    props.onAiOpen({
      type: "cyclePlan.adjust",
      targetPlanId: plan.id,
      targetPlanTitle: plan.title,
      targetPlanSummary: plan.description || `${plan.entries.length} 个日期条目`
    });
  }
}
