/** 模块用途：显示原子执行结果与对应恢复、查看入口。 */
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type {
  AiExecuteResult,
  AiExecutionFailureCode
} from "../../../shared/aiMutationTypes";
import { PrimaryButton, QuietButton } from "../../components/buttons";
import type { AiProposalDomains } from "./aiProposalDomains";

interface AiExecutionPanelProps {
  busy: boolean;
  domains: AiProposalDomains;
  result: AiExecuteResult;
  onContinue(): void;
  onRegenerate(): void;
  onViewCycle(): void;
  onViewToday(): void;
}

export function AiExecutionPanel(props: AiExecutionPanelProps) {
  if (props.result.status === "success") {
    return (
      <section className="ai-execution-panel is-success">
        <div className="ai-result-title">
          <CheckCircle2 size={28} />
          <div><p>原子写入完成</p><h3>执行成功</h3></div>
        </div>
        <p className="ai-result-summary">
          {props.result.operationCount} 项变更已保存：{props.result.summary}
        </p>
        <div className="ai-result-actions">
          {props.domains.today ? (
            <QuietButton onClick={props.onViewToday}>查看今日待办</QuietButton>
          ) : null}
          {props.domains.cycle ? (
            <PrimaryButton onClick={props.onViewCycle}>查看周期任务</PrimaryButton>
          ) : null}
          <QuietButton onClick={props.onContinue}>继续调整</QuietButton>
        </div>
      </section>
    );
  }

  return (
    <section className="ai-execution-panel is-failed">
      <div className="ai-result-title">
        <AlertTriangle size={28} />
        <div><p>整批已回滚</p><h3>校验失败</h3></div>
      </div>
      <div className="ai-failure-detail">
        <strong>{failureTitle(props.result.code)}</strong>
        <span>{props.result.message}</span>
        {props.result.targetId ? <code>{props.result.targetId}</code> : null}
      </div>
      <p className="ai-result-summary">刷新最新数据后重新生成提案，避免覆盖刚刚的修改。</p>
      <div className="ai-result-actions">
        <PrimaryButton disabled={props.busy} onClick={props.onRegenerate}>
          {props.busy ? "正在重新生成" : "刷新并重新生成"}
        </PrimaryButton>
        <QuietButton disabled={props.busy} onClick={props.onContinue}>返回对话</QuietButton>
      </div>
    </section>
  );
}

function failureTitle(code: AiExecutionFailureCode): string {
  if (code === "target_missing") return "目标已被删除";
  if (code === "version_conflict") return "目标已经被修改";
  if (code === "persistence_failed") return "本地数据写入失败";
  return "提案格式或操作无效";
}
