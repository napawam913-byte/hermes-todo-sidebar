/**
 * 模块用途：渲染单个周期计划日期条目的标题、摘要和 Markdown 编辑字段。
 * 模块边界：只上报字段变更和移除动作，不生成 CyclePlan JSON。
 */
// [待删除-2026-07-15]
// 原用途：服务周期任务手动编辑抽屉中的日期条目表单。
// 替代方案：日期条目由 AI 提案中的 cyclePlan.create.draft.entries 生成。
// 删除条件：用户确认 0.1.3-test.6 后与旧编辑抽屉一并删除。
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
