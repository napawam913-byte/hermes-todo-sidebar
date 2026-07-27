/**
 * 模块用途：提供今日待办的完成、恢复、编辑、跳过和永久删除操作。
 * 模块边界：只组织按钮和删除确认，不构造领域命令。
 */
import { Check, Pencil, RotateCcw, SkipForward, Trash2, X } from "lucide-react";
import { useState } from "react";
import { QuietButton } from "../../components/buttons";
import type { TodayItem } from "./todayItems";

interface TodoActionMenuProps {
  busy: boolean;
  item: TodayItem;
  onClose(): void;
  onComplete(): Promise<boolean>;
  onDelete(): Promise<boolean>;
  onEdit(): void;
  onReopen(): Promise<boolean>;
  onSkip(): Promise<boolean>;
}

export function TodoActionMenu(props: TodoActionMenuProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const completed = props.item.status === "completed";

  async function run(action: () => Promise<boolean>) {
    if (await action()) props.onClose();
  }

  return (
    <section className="todo-action-menu" aria-label={`${props.item.title}操作菜单`}>
      <header><strong>待办操作</strong><QuietButton icon={<X size={15} />} onClick={props.onClose}>关闭</QuietButton></header>
      <div className="todo-action-grid">
        {completed ? (
          <QuietButton disabled={props.busy} icon={<RotateCcw size={16} />} onClick={() => void run(props.onReopen)}>恢复待办</QuietButton>
        ) : (
          <QuietButton disabled={props.busy} icon={<Check size={16} />} onClick={() => void run(props.onComplete)}>完成待办</QuietButton>
        )}
        {props.item.kind === "manual" ? (
          <QuietButton disabled={props.busy} icon={<Pencil size={16} />} onClick={props.onEdit}>编辑待办</QuietButton>
        ) : (
          <QuietButton disabled={props.busy} icon={<SkipForward size={16} />} onClick={() => void run(props.onSkip)}>跳过条目</QuietButton>
        )}
        <QuietButton
          className="is-danger"
          disabled={props.busy}
          icon={<Trash2 size={16} />}
          onClick={() => confirmDelete ? void run(props.onDelete) : setConfirmDelete(true)}
        >
          {confirmDelete ? "确认永久删除" : "永久删除"}
        </QuietButton>
      </div>
      {confirmDelete ? <p className="danger-copy">删除后不可恢复，请再次确认。</p> : null}
    </section>
  );
}
