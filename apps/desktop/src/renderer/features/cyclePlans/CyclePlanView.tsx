/**
 * 模块用途：周期任务主视图，展示主题列表，并在右侧抽屉中展示选中主题详情。
 * 模块边界：当前只读展示 mock/本地计划，不创建真实 Hermes 或 AI 任务。
 */
import { Plus, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PrimaryButton, QuietButton } from "../../components/buttons";
import { CyclePlanCard } from "./CyclePlanCard";
import { CyclePlanDrawer } from "./CyclePlanDrawer";
import type { CyclePlan } from "./cyclePlanTypes";

interface CyclePlanViewProps {
  detailResetVersion: number;
  onDetailOpenChange: (open: boolean) => void;
  plans: CyclePlan[];
  todayKey: string;
}

export function CyclePlanView({
  detailResetVersion,
  onDetailOpenChange,
  plans,
  todayKey
}: CyclePlanViewProps) {
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === selectedPlanId),
    [plans, selectedPlanId]
  );
  const detailOpen = Boolean(selectedPlan);

  useEffect(() => {
    setSelectedPlanId(null);
  }, [detailResetVersion]);

  useEffect(() => {
    onDetailOpenChange(detailOpen);
    return () => {
      if (detailOpen) onDetailOpenChange(false);
    };
  }, [detailOpen, onDetailOpenChange]);

  return (
    <section className={selectedPlan ? "cycle-plan-view has-drawer" : "cycle-plan-view"}>
      <div className="cycle-plan-toolbar">
        <div>
          <p>周期任务</p>
          <h2>按日期生成今日待办</h2>
        </div>
        <div className="cycle-plan-actions">
          <QuietButton disabled icon={<Sparkles size={16} strokeWidth={1.8} />}>
            AI 安排草稿
          </QuietButton>
          <PrimaryButton disabled icon={<Plus size={16} strokeWidth={2} />}>
            手动添加
          </PrimaryButton>
        </div>
      </div>

      <div className="cycle-plan-list">
        {plans.length === 0 ? (
          <div className="empty-state">
            <strong>暂无周期任务</strong>
            <span>后续可以手动创建，或让 Hermes/AI 先生成草稿再确认。</span>
          </div>
        ) : (
          plans.map((plan) => (
            <CyclePlanCard
              key={plan.id}
              plan={plan}
              selected={plan.id === selectedPlanId}
              todayKey={todayKey}
              onOpen={() => setSelectedPlanId(plan.id)}
            />
          ))
        )}
      </div>
      {selectedPlan ? (
        <CyclePlanDrawer
          key={selectedPlan.id}
          plan={selectedPlan}
          todayKey={todayKey}
          onClose={() => setSelectedPlanId(null)}
        />
      ) : null}
    </section>
  );
}
