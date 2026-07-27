/**
 * 模块用途：按需说明模型本次可操作的范围和人工确认边界。
 * 模块边界：不展示内部字段，不读取业务数据，也不触发模型调用。
 */
import { ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { QuietButton } from "../../components/buttons";

interface AiScopePopoverProps {
  contextLabel: string;
}

export function AiScopePopover({ contextLabel }: AiScopePopoverProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div className="ai-scope-control" ref={rootRef}>
      <QuietButton
        aria-expanded={open}
        aria-haspopup="dialog"
        className="ai-scope-trigger"
        icon={<ShieldCheck size={15} strokeWidth={1.8} />}
        onClick={() => setOpen((current) => !current)}
      >
        操作范围
      </QuietButton>
      {open ? (
        <div aria-label="AI 操作范围" className="ai-scope-popover" role="dialog">
          <strong>{contextLabel}</strong>
          <ul>
            <li>可创建或调整本次周期任务及每日条目。</li>
            <li>生成提案时会发送当前待办和周期任务。</li>
            <li>所有变更都要经过你的确认才会写入。</li>
          </ul>
          <small>API Key 不会进入对话内容。</small>
        </div>
      ) : null}
    </div>
  );
}
