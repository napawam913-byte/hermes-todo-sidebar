/**
 * 模块用途：在固定右栏中创建或编辑周期计划及其多个日期条目。
 * 模块边界：只管理表单草稿并返回统一 CyclePlan，不直接访问仓储。
 */
import { Plus, Save, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { DetailDrawerShell } from "../../components/DetailDrawerShell";
import { PrimaryButton, QuietButton } from "../../components/buttons";
import { createCyclePlanDraft, createCyclePlanEntryDraft, saveCyclePlanDraft, type CyclePlanDraft } from "./cyclePlanDraft";
import { CyclePlanEntryFields } from "./CyclePlanEntryFields";
import type { CyclePlan } from "./cyclePlanTypes";

interface CyclePlanEditorDrawerProps {
  dateKey: string;
  plan?: CyclePlan;
  onClose: () => void;
  onSave: (plan: CyclePlan) => void;
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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    props.onSave(saveCyclePlanDraft(draft, {
      existingPlan: props.plan,
      idFactory: createId,
      now: new Date()
    }));
  }

  return (
    <DetailDrawerShell label="周期任务编辑" title={props.plan ? `编辑 ${props.plan.title}` : "新建周期任务"} onClose={props.onClose}>
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
          <QuietButton icon={<X size={16} />} onClick={props.onClose}>取消</QuietButton>
          <PrimaryButton icon={<Save size={16} />} type="submit">保存计划</PrimaryButton>
        </footer>
      </form>
    </DetailDrawerShell>
  );
}
