/**
 * 模块用途：快速新增待办输入条，第一版只收集待办标题。
 * 模块边界：只收集表单输入，不直接修改待办列表。
 */
import { Plus } from "lucide-react";
import { FormEvent, useState } from "react";
import { PrimaryButton } from "../../components/buttons";

interface QuickAddBarProps {
  busy?: boolean;
  onAdd: (title: string) => Promise<boolean>;
}

export function QuickAddBar({ busy = false, onAdd }: QuickAddBarProps) {
  const [title, setTitle] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return;

    if (await onAdd(title)) setTitle("");
  }

  return (
    <form className="quick-add" onSubmit={handleSubmit}>
      <input
        aria-label="待办标题"
        placeholder="添加一个待办..."
        value={title}
        disabled={busy}
        onChange={(event) => setTitle(event.target.value)}
      />
      <PrimaryButton disabled={busy} icon={<Plus size={16} strokeWidth={2} />} type="submit">
        {busy ? "保存中" : "添加"}
      </PrimaryButton>
    </form>
  );
}
