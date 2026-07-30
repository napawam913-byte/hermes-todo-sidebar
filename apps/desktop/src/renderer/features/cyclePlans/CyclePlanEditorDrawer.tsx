/**
 * 模块用途：在同一面板详情页中创建或编辑周期计划及其日期条目。
 * 模块边界：只管理表单草稿并返回统一 CyclePlan，不直接访问仓储。
 */
// [待删除-2026-07-15]
// 原用途：手动创建和编辑周期任务内容。
// 替代方案：周期任务统一通过 AI 标准 JSON 提案创建或调整。
// 删除条件：用户确认 0.1.3-test.6 的 API 创建与调整流程稳定后再请求许可。
import { Plus, Save, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { DetailPageShell } from "../../components/DetailPageShell";
import { PrimaryButton, QuietButton } from "../../components/buttons";
import { createCyclePlanDraft, createCyclePlanEntryDraft, saveCyclePlanDraft, type CyclePlanDraft } from "./cyclePlanDraft";
import { CyclePlanEntryFields } from "./CyclePlanEntryFields";
import type { CyclePlan } from "./cyclePlanTypes";

interface CyclePlanEditorDrawerProps {
  busy: boolean;
  dateKey: string;
  plan?: CyclePlan;
  onClose: () => void;
  onSave: (plan: CyclePlan) => Promise<boolean>;
}

function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `local_${Date.now()}_${Math.random()}`;
}

export function CyclePlanEditorDrawer(props: CyclePlanEditorDrawerProps) {
  const [draft, setDraft] = useState<CyclePlanDraft>(() =>
    createCyclePlanDraft({ dateKey: props.dateKey, idFactory: createId, plan: props.plan })
  );

  function updateEntry(index: number, entry: CyclePlanDraft["entries"][number]) {
    setDraft((current) => ({
      ...current,
      entries: current.entries.map((item, itemIndex) => (itemIndex === index ? entry : item))
    }));
  }

  function removeEntry(index: number) {
    setDraft((current) => ({
      ...current,
      entries: current.entries.filter((_, itemIndex) => itemIndex !== index)
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (props.busy) return;
    await props.onSave(saveCyclePlanDraft(draft, {
      existingPlan: props.plan,
      idFactory: createId,
      now: new Date()
    }));
  }

  return (
    <DetailPageShell label="周期计划编辑" title={props.plan ? `编辑 ${props.plan.title}` : "新建周期任务"} onBack={props.onClose}>
      <form className="cycle-plan-editor" onSubmit={handleSubmit}>
        <div className="cycle-plan-fields">
          <label><span>计划标题</span><input required name="plan-title" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
          <label><span>主题</span><input required name="plan-topic" value={draft.topic} onChange={(event) => setDraft({ ...draft, topic: event.target.value })} /></label>
          <label><span>计划说明</span><textarea name="plan-description" rows={3} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
        </div>
        <div className="cycle-editor-section-title">
          <strong>日期条目</strong>
          <QuietButton icon={<Plus size={15} strokeWidth={1.8} />} onClick={() => setDraft((current) => ({
            ...current,
            entries: [...current.entries, createCyclePlanEntryDraft(props.dateKey, createId)]
          }))}>添加条目</QuietButton>
        </div>
        <div className="cycle-editor-entry-list">
          {draft.entries.map((entry, index) => (
            <CyclePlanEntryFields
              canRemove={draft.entries.length > 1}
              entry={entry}
              index={index}
              key={entry.draftId}
              onChange={(nextEntry) => updateEntry(index, nextEntry)}
              onRemove={() => removeEntry(index)}
            />
          ))}
        </div>
        <footer className="cycle-editor-footer">
          <QuietButton disabled={props.busy} icon={<X size={16} />} onClick={props.onClose}>取消</QuietButton>
          <PrimaryButton disabled={props.busy} icon={<Save size={16} />} type="submit">
            {props.busy ? "保存中" : "保存计划"}
          </PrimaryButton>
        </footer>
      </form>
    </DetailPageShell>
  );
}
