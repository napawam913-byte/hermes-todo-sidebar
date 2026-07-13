/**
 * 模块用途：周期任务主题详情抽屉，展示主题下的日期条目和选中内容块。
 * 模块边界：只读展示周期任务细节，不编辑条目，也不调用 Hermes。
 */
import { Pencil } from "lucide-react";
import { useMemo, useState } from "react";
import { DetailPageShell } from "../../components/DetailPageShell";
import { QuietButton } from "../../components/buttons";
import { ContentBlockPreview } from "./ContentBlockPreview";
import { CyclePlanEntryCard } from "./CyclePlanEntryCard";
import type { CyclePlan } from "./cyclePlanTypes";

interface CyclePlanDrawerProps {
  plan: CyclePlan;
  todayKey: string;
  onClose: () => void;
  onEdit: () => void;
}

export function CyclePlanDrawer({ onClose, onEdit, plan, todayKey }: CyclePlanDrawerProps) {
  const sortedEntries = useMemo(
    () => [...plan.entries].sort((left, right) => left.date.localeCompare(right.date)),
    [plan.entries]
  );
  const todayEntry = sortedEntries.find((entry) => entry.date === todayKey);
  const [selectedEntryId, setSelectedEntryId] = useState(todayEntry?.id ?? sortedEntries[0]?.id ?? "");
  const selectedEntry = sortedEntries.find((entry) => entry.id === selectedEntryId) ?? sortedEntries[0];

  return (
    <DetailPageShell label="周期计划详情" title={plan.title} onBack={onClose}>
      <section className="cycle-drawer-summary">
        <span>7 天计划</span>
        <strong>按日期生成今日待办</strong>
        <em>今日 {sortedEntries.filter((entry) => entry.date === todayKey).length}</em>
      </section>

      <div className="cycle-drawer-actions">
        <QuietButton icon={<Pencil size={15} strokeWidth={1.8} />} onClick={onEdit}>
          编辑计划
        </QuietButton>
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
      ) : null}
    </DetailPageShell>
  );
}
