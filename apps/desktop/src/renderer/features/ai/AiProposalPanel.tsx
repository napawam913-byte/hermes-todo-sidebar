/** 模块用途：整批展示模型提案并提供唯一确认入口；模块边界：不执行单项操作。 */
import type { AiConversationTurn, AiMutationProposal } from "../../../shared/aiMutationTypes";
import { PrimaryButton, QuietButton } from "../../components/buttons";
import { AiOperationCard } from "./AiOperationCard";
import type { AiProposalPhase } from "./aiPlannerState";

interface AiProposalPanelProps {
  busy: boolean;
  conversation: AiConversationTurn[];
  phase: AiProposalPhase;
  proposal: AiMutationProposal;
  onCancel(): void;
  onConfirm(): void;
  onReturnToConversation(): void;
}

export function AiProposalPanel(props: AiProposalPanelProps) {
  const deleteCount = props.proposal.operations.filter((item) => item.type.endsWith(".delete")).length;
  return (
    <div className="ai-proposal-page">
      <aside className="ai-proposal-conversation">
        <h3>对话摘要</h3>
        {props.conversation.slice(-3).map((turn, index) => (
          <div className={`ai-bubble is-${turn.role}`} key={index}><span>{turn.role === "user" ? "你" : "AI"}</span><p>{turn.content}</p></div>
        ))}
        <small>模型只提交变更意图；ID、时间戳和来源由桌面端补全。</small>
      </aside>
      <section className="ai-proposal-main">
        <div className="ai-proposal-heading">
          <div><h3>变更提案</h3><p>{props.proposal.summary}</p></div>
          {deleteCount ? <span className="ai-danger-pill">{deleteCount} 项永久删除</span> : null}
        </div>
        <div className="ai-operation-list">
          {props.proposal.operations.map((operation, index) => <AiOperationCard key={`${operation.type}-${index}`} operation={operation} />)}
        </div>
      </section>
      {props.phase === "pending" ? (
        <footer className="ai-confirm-bar">
          <div><strong>确认后一次写入 {props.proposal.operations.length} 项变更</strong>{deleteCount ? <span>含永久删除，执行后不可恢复</span> : null}</div>
          <div><QuietButton disabled={props.busy} onClick={props.onCancel}>放弃草稿</QuietButton><PrimaryButton disabled={props.busy} onClick={props.onConfirm}>{props.busy ? "执行中" : `确认执行 ${props.proposal.operations.length} 项`}</PrimaryButton></div>
        </footer>
      ) : (
        <footer className="ai-confirm-bar is-readonly">
          <div><strong>{props.phase === "success" ? "该提案已经执行" : "该提案执行失败，整批已回滚"}</strong><span>当前仅供核对，不能再次执行</span></div>
          <QuietButton onClick={props.onReturnToConversation}>返回对话</QuietButton>
        </footer>
      )}
    </div>
  );
}
