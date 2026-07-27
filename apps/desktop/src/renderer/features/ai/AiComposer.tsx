/** 模块用途：提供受控、自适应且兼容中文输入法的自然语言输入。 */
import { Send } from "lucide-react";
import { FormEvent, KeyboardEvent, useEffect, useRef } from "react";
import { IconButton } from "../../components/buttons";
import { clampComposerHeight, shouldSubmitComposer } from "./aiComposerInteraction";

interface AiComposerProps {
  busy: boolean;
  placeholder: string;
  value: string;
  onChange(message: string): void;
  onSend(message: string): void;
}

export function AiComposer({ busy, placeholder, value, onChange, onSend }: AiComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => resizeTextarea(textareaRef.current), [value]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const next = value.trim();
    if (!next || busy) return;
    onSend(next);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    const isComposing = event.nativeEvent.isComposing || event.keyCode === 229;
    if (!shouldSubmitComposer({ key: event.key, shiftKey: event.shiftKey, isComposing })) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  return (
    <form className="ai-composer-dock" onSubmit={submit}>
      <div className="ai-composer-control">
        <textarea
          aria-label="与 AI 讨论周期计划"
          id="ai-message"
          maxLength={8000}
          placeholder={placeholder}
          ref={textareaRef}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            resizeTextarea(event.currentTarget);
          }}
          onKeyDown={handleKeyDown}
        />
        <IconButton
          className="ai-composer-send"
          disabled={busy || !value.trim()}
          icon={<Send size={16} />}
          type="submit"
        >
          {busy ? "生成中" : "发送"}
        </IconButton>
      </div>
      <span className="ai-composer-hint">Enter 发送 · Shift+Enter 换行</span>
    </form>
  );
}

function resizeTextarea(textarea: HTMLTextAreaElement | null): void {
  if (!textarea) return;
  textarea.style.height = "44px";
  const nextHeight = clampComposerHeight(textarea.scrollHeight);
  textarea.style.height = `${nextHeight}px`;
  textarea.style.overflowY = textarea.scrollHeight > 120 ? "auto" : "hidden";
}
