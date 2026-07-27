/**
 * 模块用途：编辑普通待办的标题、日期和备注，并提供永久删除确认。
 * 模块边界：只管理表单状态，具体命令执行由父级回调负责。
 */
import { Save, Trash2, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { DetailPageShell } from "../../components/DetailPageShell";
import { PrimaryButton, QuietButton } from "../../components/buttons";
import type { Todo } from "./types";

interface TodoEditorDrawerProps {
  busy: boolean;
  interactionResetVersion?: number;
  todo: Todo;
  onClose(): void;
  onDelete(): Promise<boolean>;
  onSave(draft: { title: string; date: string; notes?: string }): Promise<boolean>;
}

export function TodoEditorDrawer(props: TodoEditorDrawerProps) {
  const [title, setTitle] = useState(props.todo.title);
  const [date, setDate] = useState(props.todo.date);
  const [notes, setNotes] = useState(props.todo.notes ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setConfirmDelete(false);
  }, [props.interactionResetVersion]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || !date || props.busy) return;
    if (await props.onSave({ title, date, notes })) props.onClose();
  }

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    if (await props.onDelete()) props.onClose();
  }

  return (
    <DetailPageShell label="普通待办编辑" title="编辑待办" onBack={props.onClose}>
      <form className="todo-editor" onSubmit={handleSubmit}>
        <label><span>标题</span><input required value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <label><span>日期</span><input required type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
        <label><span>备注</span><textarea rows={5} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
        {confirmDelete ? (
          <div className="danger-confirm" role="alert">
            <strong>永久删除后不可恢复</strong>
            <span>再次点击“确认永久删除”执行。</span>
          </div>
        ) : null}
        <footer className="todo-editor-actions">
          <QuietButton disabled={props.busy} icon={<X size={16} />} onClick={props.onClose}>取消</QuietButton>
          <QuietButton
            className="is-danger"
            disabled={props.busy}
            icon={<Trash2 size={16} />}
            onClick={handleDelete}
          >
            {confirmDelete ? "确认永久删除" : "永久删除"}
          </QuietButton>
          <PrimaryButton disabled={props.busy} icon={<Save size={16} />} type="submit">
            {props.busy ? "保存中" : "保存修改"}
          </PrimaryButton>
        </footer>
      </form>
    </DetailPageShell>
  );
}
