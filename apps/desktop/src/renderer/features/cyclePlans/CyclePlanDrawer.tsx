/**
 * 模块用途：周期任务主题详情抽屉，展示主题下的日期条目和选中内容块。
 * 模块边界：只读展示周期任务细节，不编辑条目，也不调用 Hermes。
 */
import { Archive, Check, Pause, Play, RotateCcw, SkipForward, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DetailPageShell } from "../../components/DetailPageShell";
import { QuietButton } from "../../components/buttons";
import type { ManualMutationHandler } from "../../data/manualMutation";
import { ContentBlockPreview } from "./ContentBlockPreview";
import { CyclePlanEntryCard } from "./CyclePlanEntryCard";
import {
  buildDeletePlanOperation,
  buildEntryStatusOperation,
  buildSetPlanStatusOperation
} from "./cyclePlanMutationCommands";
import type { CyclePlan } from "./cyclePlanTypes";

interface CyclePlanDrawerProps {
  busy: boolean;
  interactionResetVersion?: number;
  plan: CyclePlan;
  todayKey: string;
  onClose: () => void;
  onAiAdjust: () => void;
  onMutate: ManualMutationHandler;
}

export function CyclePlanDrawer(props: CyclePlanDrawerProps) {
  const { onClose, onAiAdjust, plan, todayKey } = props;
  const [confirmPlanDelete, setConfirmPlanDelete] = useState(false);
  const [confirmEntryDelete, setConfirmEntryDelete] = useState(false);
  useEffect(() => {
    setConfirmPlanDelete(false);
    setConfirmEntryDelete(false);
  }, [props.interactionResetVersion]);
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
        <QuietButton disabled={props.busy} icon={<Sparkles size={15} strokeWidth={1.8} />} onClick={onAiAdjust}>
          AI 调整
        </QuietButton>
        <QuietButton
          disabled={props.busy}
          icon={plan.status === "active" ? <Pause size={15} /> : <Play size={15} />}
          onClick={() => void runPlanStatus(plan.status === "active" ? "paused" : "active")}
        >
          {plan.status === "active" ? "暂停计划" : "启用计划"}
        </QuietButton>
        <QuietButton disabled={props.busy} icon={<Archive size={15} />} onClick={() => void runPlanStatus("archived")}>
          归档计划
        </QuietButton>
        <QuietButton
          className="is-danger"
          disabled={props.busy}
          icon={<Trash2 size={15} />}
          onClick={() => confirmPlanDelete ? void deletePlan() : setConfirmPlanDelete(true)}
        >
          {confirmPlanDelete ? "确认删除计划" : "删除计划"}
        </QuietButton>
      </div>
      {confirmPlanDelete ? (
        <div className="danger-confirm" role="alert">
          <strong>将永久删除计划及其 {plan.entries.length} 个条目</strong>
          <span>此操作不可恢复，请再次确认。</span>
        </div>
      ) : null}

      <div className="cycle-entry-list">
        {sortedEntries.map((entry) => (
          <CyclePlanEntryCard
            active={entry.id === selectedEntry?.id}
            entry={entry}
            key={entry.id}
            onSelect={() => { setSelectedEntryId(entry.id); setConfirmEntryDelete(false); }}
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
          <div className="cycle-entry-actions">
            <QuietButton
              disabled={props.busy}
              icon={selectedEntry.status === "completed" ? <RotateCcw size={15} /> : <Check size={15} />}
              onClick={() => void runEntry(selectedEntry.status === "completed" ? "reopen" : "complete")}
            >
              {selectedEntry.status === "completed" ? "恢复条目" : "完成条目"}
            </QuietButton>
            <QuietButton disabled={props.busy} icon={<SkipForward size={15} />} onClick={() => void runEntry("skip")}>
              跳过条目
            </QuietButton>
            <QuietButton
              className="is-danger"
              disabled={props.busy}
              icon={<Trash2 size={15} />}
              onClick={() => confirmEntryDelete ? void deleteEntry() : setConfirmEntryDelete(true)}
            >
              {confirmEntryDelete ? "确认永久删除条目" : "删除条目"}
            </QuietButton>
          </div>
          {confirmEntryDelete ? <div className="danger-confirm" role="alert">永久删除此条目后不可恢复，请再次确认。</div> : null}
        </div>
      ) : null}
    </DetailPageShell>
  );

  async function runPlanStatus(status: "active" | "paused" | "archived") {
    await props.onMutate(`${status === "active" ? "启用" : status === "paused" ? "暂停" : "归档"}${plan.title}`, [
      buildSetPlanStatusOperation(plan, status)
    ]);
  }

  async function deletePlan() {
    if (await props.onMutate(`永久删除${plan.title}`, [buildDeletePlanOperation(plan)])) onClose();
  }

  async function runEntry(action: "complete" | "reopen" | "skip" | "delete"): Promise<boolean> {
    if (!selectedEntry) return false;
    return props.onMutate(`更新条目：${selectedEntry.title}`, [buildEntryStatusOperation(selectedEntry, action)]);
  }

  async function deleteEntry() {
    if (await runEntry("delete")) setConfirmEntryDelete(false);
  }
}
