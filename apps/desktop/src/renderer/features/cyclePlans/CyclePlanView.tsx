/**
 * 模块用途：周期任务主视图，协调主题列表、只读详情和手动编辑抽屉。
 * 模块边界：只管理视图选择，不调用 Hermes 或生成 AI 草稿。
 */
import { Plus, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PrimaryButton, QuietButton } from "../../components/buttons";
import { CyclePlanCard } from "./CyclePlanCard";
import { CyclePlanDrawer } from "./CyclePlanDrawer";
import { CyclePlanEditorDrawer } from "./CyclePlanEditorDrawer";
import type { CyclePlan } from "./cyclePlanTypes";

interface CyclePlanViewProps {
  detailResetVersion: number;
  onDetailOpenChange: (open: boolean) => void;
  plans: CyclePlan[];
  todayKey: string;
  onUpsertPlan: (plan: CyclePlan) => void;
}

export function CyclePlanView({
  detailResetVersion,
  onDetailOpenChange,
  onUpsertPlan,
  plans,
  todayKey
}: CyclePlanViewProps) {
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [editorPlanId, setEditorPlanId] = useState<"new" | string | null>(null);
  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === selectedPlanId),
    [plans, selectedPlanId]
  );
  const editorPlan = plans.find((plan) => plan.id === editorPlanId);
  const drawerOpen = Boolean(selectedPlan) || editorPlanId !== null;

  useEffect(() => {
    setSelectedPlanId(null);
    setEditorPlanId(null);
  }, [detailResetVersion]);

  useEffect(() => {
    onDetailOpenChange(drawerOpen);
    return () => {
      if (drawerOpen) onDetailOpenChange(false);
    };
  }, [drawerOpen, onDetailOpenChange]);

  return (
    <section className={drawerOpen ? "cycle-plan-view has-drawer" : "cycle-plan-view"}>
      <div className="cycle-plan-toolbar">
        <div>
          <p>周期任务</p>
          <h2>按日期生成今日待办</h2>
        </div>
        <div className="cycle-plan-actions">
          <QuietButton disabled icon={<Sparkles size={16} strokeWidth={1.8} />}>
            AI 安排草稿
          </QuietButton>
          <PrimaryButton
            icon={<Plus size={16} strokeWidth={2} />}
            onClick={() => {
              setSelectedPlanId(null);
              setEditorPlanId("new");
            }}
          >
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
              onOpen={() => {
                setEditorPlanId(null);
                setSelectedPlanId(plan.id);
              }}
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
          onEdit={() => {
            setSelectedPlanId(null);
            setEditorPlanId(selectedPlan.id);
          }}
        />
      ) : null}
      {editorPlanId !== null ? (
        <CyclePlanEditorDrawer
          dateKey={todayKey}
          plan={editorPlan}
          onClose={() => setEditorPlanId(null)}
          onSave={(plan) => {
            onUpsertPlan(plan);
            setEditorPlanId(null);
            setSelectedPlanId(plan.id);
          }}
        />
      ) : null}
    </section>
  );
}
