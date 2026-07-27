/**
 * 模块用途：展示 AI 空对话中的可编辑提示建议，并把选中内容交给受控输入草稿。
 * 模块边界：不提交表单、不调用模型，也不持有会话状态。
 */
interface AiPromptSuggestionsProps {
  suggestions: readonly string[];
  onSelect(prompt: string): void;
}

export function AiPromptSuggestions({ suggestions, onSelect }: AiPromptSuggestionsProps) {
  return (
    <div className="ai-prompt-suggestions" aria-label="规划建议">
      {suggestions.map((suggestion) => (
        <button key={suggestion} type="button" onClick={() => onSelect(suggestion)}>
          {suggestion}
        </button>
      ))}
    </div>
  );
}
