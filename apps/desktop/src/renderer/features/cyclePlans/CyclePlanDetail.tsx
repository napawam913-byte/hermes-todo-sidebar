/**
 * 模块用途：周期计划详情页，展示一个计划下的日期条目和选中条目的内容块。
 * 模块边界：只读展示计划结构，不做条目编辑或 AI 重新安排。
 */
import { ArrowLeft } from "lucide-react";
import { useMemo, useState } from "react";
import { QuietButton } from "../../components/buttons";
import { ContentBlockPreview } from "./ContentBlockPreview";
import { CyclePlanEntryCard } from "./CyclePlanEntryCard";
import type { CyclePlan } from "./cyclePlanTypes";

interface CyclePlanDetailProps {
  plan: CyclePlan;
  onBack: () => void;
}

export function CyclePlanDetail({ onBack, plan }: CyclePlanDetailProps) {
  const sortedEntries = useMemo(
    () => [...plan.entries].sort((left, right) => left.date.localeCompare(right.date)),
    [plan.entries]
  );
  const [selectedEntryId, setSelectedEntryId] = useState(sortedEntries[0]?.id ?? "");
  const selectedEntry = sortedEntries.find((entry) => entry.id === selectedEntryId) ?? sortedEntries[0];

  return (
    <section className="cycle-detail">
      <div className="cycle-detail-header">
        <QuietButton icon={<ArrowLeft size={16} strokeWidth={1.8} />} onClick={onBack}>
          返回
        </QuietButton>
        <div>
          <p>{plan.topic}</p>
          <h2>{plan.title}</h2>
        </div>
      </div>

      <div className="cycle-entry-list">
        {sortedEntries.map((entry) => (
          <CyclePlanEntryCard
            active={entry.id === selectedEntry?.id}
            entry={entry}
            key={entry.id}
            onSelect={() => setSelectedEntryId(entry.id)}
          />
        ))}
      </div>

      {selectedEntry ? (
        <div className="cycle-content-preview">
          <div className="cycle-content-title">
            <span>{selectedEntry.date}</span>
            <h3>{selectedEntry.title}</h3>
          </div>
          {selectedEntry.contentBlocks.map((block) => (
            <ContentBlockPreview block={block} key={block.id} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <strong>这个计划还没有条目</strong>
          <span>使用 AI 生成标准 JSON 提案，确认后写入日期条目。</span>
        </div>
      )}
    </section>
  );
}
