/** 模块用途：组合全宽长对话、固定输入区和按需操作范围说明。 */
import { ArrowDown, Sparkles } from "lucide-react";
import type { AiConversationTurn } from "../../../shared/aiMutationTypes";
import { AiComposer } from "./AiComposer";
import { AiPromptSuggestions } from "./AiPromptSuggestions";
import { AiScopePopover } from "./AiScopePopover";
import type { AiLaunchPresentation } from "./aiPlannerLaunchContext";
import { useAiChatScroll } from "./useAiChatScroll";

interface AiConversationPanelProps {
  busy: boolean;
  composerDraft: string;
  conversation: AiConversationTurn[];
  modelName: string;
  presentation: AiLaunchPresentation;
  onComposerChange(message: string): void;
  onSend(message: string): void;
}

export function AiConversationPanel(props: AiConversationPanelProps) {
  const scroll = useAiChatScroll(props.conversation.length + (props.busy ? 1 : 0));
  const showOnboarding = props.conversation.length === 0 && !props.busy;
  return (
    <div className="ai-conversation-layout">
      <section className="ai-chat-column">
        <div className="ai-chat-heading">
          <div className="ai-chat-heading-main">
            <h3>{props.presentation.chatTitle}</h3>
            <span className={props.busy ? "ai-status is-busy" : "ai-status"}>
              {props.busy
                ? `${props.modelName || "模型"} 正在生成`
                : `已连接 · ${props.modelName || "未命名模型"}`}
            </span>
          </div>
          <AiScopePopover contextLabel={props.presentation.contextLabel} />
        </div>
        <div className="ai-chat-scroll-shell">
          <div
            aria-live="polite"
            className="ai-chat-list"
            onScroll={scroll.onScroll}
            ref={scroll.listRef}
            role="log"
          >
            {showOnboarding ? (
              <div className="ai-chat-onboarding">
                <span className="ai-onboarding-icon" aria-hidden="true">
                  <Sparkles size={18} />
                </span>
                <h4>{props.presentation.emptyTitle}</h4>
                <p>{props.presentation.emptyDescription}</p>
                <AiPromptSuggestions
                  suggestions={props.presentation.suggestions}
                  onSelect={props.onComposerChange}
                />
              </div>
            ) : props.conversation.map((turn, index) => (
              <div className={`ai-bubble is-${turn.role}`} key={`${turn.role}-${index}`}>
                <span>{turn.role === "user" ? "你" : "AI"}</span>
                <p>{turn.content}</p>
              </div>
            ))}
            {props.busy ? <div className="ai-bubble is-assistant is-typing"><span>AI</span><p>正在思考...</p></div> : null}
          </div>
          {scroll.hasUnread ? (
            <button className="ai-jump-latest" onClick={() => scroll.jumpToLatest()} type="button">
              <ArrowDown size={14} /> 跳到最新
            </button>
          ) : null}
        </div>
        <AiComposer
          busy={props.busy}
          placeholder={props.presentation.placeholder}
          value={props.composerDraft}
          onChange={props.onComposerChange}
          onSend={props.onSend}
        />
      </section>
    </div>
  );
}
