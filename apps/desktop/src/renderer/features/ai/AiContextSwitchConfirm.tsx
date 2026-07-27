/**
 * 模块用途：在切换 AI 任务上下文前保护尚未确认的变更提案。
 * 模块边界：只呈现选择，不丢弃提案，也不启动新的模型会话。
 */
import { ArrowLeft, Trash2 } from "lucide-react";
import { DetailPageShell } from "../../components/DetailPageShell";
import { PrimaryButton, QuietButton } from "../../components/buttons";
import type { AiPlannerLaunchContext } from "./aiPlannerLaunchContext";

interface AiContextSwitchConfirmProps {
  busy: boolean;
  nextContext: AiPlannerLaunchContext;
  onContinueCurrent(): void;
  onDiscardAndSwitch(): void;
}

export function AiContextSwitchConfirm(props: AiContextSwitchConfirmProps) {
  const nextLabel = props.nextContext.type === "cyclePlan.create"
    ? "新建周期任务"
    : `调整「${props.nextContext.targetPlanTitle}」`;

  return (
    <DetailPageShell label="AI 会话保护" title="已有未确认提案" onBack={props.onContinueCurrent}>
      <div className="danger-confirm" role="alert">
        <strong>当前提案尚未确认</strong>
        <span>要开始“{nextLabel}”，需要先明确放弃当前提案。</span>
      </div>
      <footer className="todo-editor-actions">
        <QuietButton
          disabled={props.busy}
          icon={<ArrowLeft size={16} />}
          onClick={props.onContinueCurrent}
        >
          继续原提案
        </QuietButton>
        <PrimaryButton
          disabled={props.busy}
          icon={<Trash2 size={16} />}
          onClick={props.onDiscardAndSwitch}
        >
          放弃并切换
        </PrimaryButton>
      </footer>
    </DetailPageShell>
  );
}
