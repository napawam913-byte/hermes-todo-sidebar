/**
 * 模块用途：周期计划列表中的计划卡，展示主题、状态、条目数和今日命中数。
 * 模块边界：只展示计划摘要，不展开具体条目内容。
 */
import { ChevronRight } from "lucide-react";
import { formatCyclePlanStatus, getCyclePlanStats } from "./cyclePlanModel";
import type { CyclePlan } from "./cyclePlanTypes";
import { SourcePill, type SourcePillLabel } from "../todos/SourcePill";

interface CyclePlanCardProps {
  plan: CyclePlan;
  selected?: boolean;
  todayKey: string;
  onOpen: () => void;
}

export function CyclePlanCard({ onOpen, plan, selected = false, todayKey }: CyclePlanCardProps) {
  const stats = getCyclePlanStats(plan, todayKey);

  return (
    <button className={selected ? "cycle-plan-card is-selected" : "cycle-plan-card"} type="button" onClick={onOpen}>
      <div className="cycle-plan-card-main">
        <div className="cycle-plan-title-row">
          <h2>{plan.title}</h2>
          <SourcePill label={getSourceLabel(plan.source)} />
        </div>
        <p>{plan.description}</p>
        <div className="cycle-plan-meta">
          <span>{plan.topic}</span>
          <span>{formatCyclePlanStatus(plan.status)}</span>
          <span>{stats.totalEntries} 条</span>
          <strong>今日 {stats.todayHits}</strong>
        </div>
      </div>
      <ChevronRight size={17} strokeWidth={1.8} />
    </button>
  );
}

function getSourceLabel(source: CyclePlan["source"]): SourcePillLabel {
  if (source.type === "ai_draft") return "AI草稿";
  if (source.type === "hermes") return "Hermes";
  if (source.type === "feishu") return "飞书";
  return "手动";
}
