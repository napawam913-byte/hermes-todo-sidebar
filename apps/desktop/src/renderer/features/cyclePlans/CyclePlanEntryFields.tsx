/**
 * 模块用途：渲染单个周期计划日期条目的标题、摘要和 Markdown 编辑字段。
 * 模块边界：只上报字段变更和移除动作，不生成 CyclePlan JSON。
 */
import { Trash2 } from "lucide-react";
import { IconButton } from "../../components/buttons";
import type { CyclePlanEntryDraft } from "./cyclePlanDraft";

interface CyclePlanEntryFieldsProps {
  canRemove: boolean;
  entry: CyclePlanEntryDraft;
  index: number;
  onChange: (entry: CyclePlanEntryDraft) => void;
  onRemove: () => void;
}

export function CyclePlanEntryFields(props: CyclePlanEntryFieldsProps) {
  const { canRemove, entry, index, onChange, onRemove } = props;
  function update(patch: Partial<CyclePlanEntryDraft>) {
    onChange({ ...entry, ...patch });
  }

  return (
    <fieldset className="cycle-entry-fields">
      <legend>计划条目 {index + 1}</legend>
      <IconButton
        className="cycle-entry-remove"
        disabled={!canRemove}
        icon={<Trash2 size={16} strokeWidth={1.8} />}
        onClick={onRemove}
      >
        移除计划条目
      </IconButton>
      <label>
        <span>日期</span>
        <input required type="date" value={entry.date} onChange={(event) => update({ date: event.target.value })} />
      </label>
      <label>
        <span>条目标题</span>
        <input required name={`entry-title-${index}`} value={entry.title} onChange={(event) => update({ title: event.target.value })} />
      </label>
      <label>
        <span>列表摘要</span>
        <input name={`entry-summary-${index}`} value={entry.contentSummary} onChange={(event) => update({ contentSummary: event.target.value })} />
      </label>
      <label>
        <span>计划详情</span>
        <textarea name={`entry-markdown-${index}`} rows={5} value={entry.markdown} onChange={(event) => update({ markdown: event.target.value })} />
      </label>
    </fieldset>
  );
}
