/**
 * 模块用途：展示周期任务 AI 创建入口和计划卡列表。
 * 模块边界：只渲染主列表，不管理详情或执行数据变更。
 */
import { Sparkles } from "lucide-react";
import { PrimaryButton } from "../../components/buttons";
import { CyclePlanCard } from "./CyclePlanCard";
import type { CyclePlan } from "./cyclePlanTypes";

interface CyclePlanListPaneProps {
  busy: boolean;
  plans: CyclePlan[];
  selectedPlanId: string | null;
  todayKey: string;
  onAiCreate(): void;
  onOpen(plan: CyclePlan): void;
}

export function CyclePlanListPane(props: CyclePlanListPaneProps) {
  return (
    <section className="cycle-plan-view">
      <div className="cycle-plan-actions">
        <PrimaryButton
          disabled={props.busy}
          icon={<Sparkles size={16} strokeWidth={1.8} />}
          onClick={props.onAiCreate}
        >
          AI 生成周期任务
        </PrimaryButton>
      </div>

      <div className="cycle-plan-list">
        {props.plans.map((plan) => (
          <CyclePlanCard
            key={plan.id}
            plan={plan}
            selected={plan.id === props.selectedPlanId}
            todayKey={props.todayKey}
            onOpen={() => props.onOpen(plan)}
          />
        ))}
      </div>
    </section>
  );
}
