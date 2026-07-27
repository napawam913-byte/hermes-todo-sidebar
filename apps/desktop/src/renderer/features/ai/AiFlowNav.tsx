/** 模块用途：提供 AI Flow 内部返回、对话与提案切换导航。 */
import { ArrowLeft } from "lucide-react";
import type { AiPlannerScreen } from "./aiPlannerState";

interface AiFlowNavProps {
  screen: AiPlannerScreen;
  proposalCount: number;
  conversationDisabled?: boolean;
  onBack(): void;
  onOpenConversation(): void;
  onOpenProposal(): void;
}

export function AiFlowNav(props: AiFlowNavProps) {
  return (
    <nav className="ai-flow-nav" aria-label="AI 安排流程">
      <button className="ai-flow-back" type="button" onClick={props.onBack}>
        <ArrowLeft size={14} />
        <span>周期任务</span>
      </button>
      <button
        className={props.screen === "conversation" ? "is-active" : ""}
        disabled={props.conversationDisabled}
        type="button"
        onClick={props.onOpenConversation}
      >
        对话
      </button>
      <button
        className={props.screen === "proposal" ? "is-active" : ""}
        disabled={props.proposalCount === 0}
        type="button"
        onClick={props.onOpenProposal}
      >
        提案 {props.proposalCount}
      </button>
    </nav>
  );
}
