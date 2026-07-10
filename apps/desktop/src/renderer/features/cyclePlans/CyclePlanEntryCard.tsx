/**
 * 模块用途：周期计划详情中的日期条目卡，展示日期、标题、摘要和完成状态。
 * 模块边界：只渲染条目摘要，内容块由详情页单独展示。
 */
import type { CyclePlanEntry } from "./cyclePlanTypes";

interface CyclePlanEntryCardProps {
  entry: CyclePlanEntry;
  active: boolean;
  onSelect: () => void;
}

export function CyclePlanEntryCard({ active, entry, onSelect }: CyclePlanEntryCardProps) {
  return (
    <button
      className={active ? "cycle-entry-card is-active" : "cycle-entry-card"}
      type="button"
      onClick={onSelect}
    >
      <div>
        <span className="cycle-entry-date">{entry.date}</span>
        <h3>{entry.title}</h3>
        <p>{entry.contentSummary}</p>
      </div>
      <span className={`cycle-entry-status status-${entry.status}`}>
        {entry.status === "completed" ? "已完成" : entry.status === "skipped" ? "跳过" : "待办"}
      </span>
    </button>
  );
}
