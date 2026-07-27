/**
 * 模块用途：按 Figma AI Flow 组合配置、对话、提案和执行结果页面。
 * 模块边界：只编排视图；会话状态由上层持有，IPC 由 controller 管理。
 */
import { Settings2 } from "lucide-react";
import { IconButton } from "../../components/buttons";
import { AiConfigPanel } from "./AiConfigPanel";
import { AiConversationPanel } from "./AiConversationPanel";
import { AiExecutionPanel } from "./AiExecutionPanel";
import { AiFlowNav } from "./AiFlowNav";
import { AiProposalPanel } from "./AiProposalPanel";
import { getProposalDomains } from "./aiProposalDomains";
import type { AiPlannerController } from "./useAiPlanner";

interface AiPlannerViewProps {
  canExecute: boolean;
  planner: AiPlannerController;
  onClose(): void;
  onNavigate(destination: "today" | "cycle"): void;
}

export function AiPlannerView(
  { canExecute, planner, onClose, onNavigate }: AiPlannerViewProps
) {
  const proposalCount = planner.proposal?.operations.length ?? 0;
  const domains = planner.proposal
    ? getProposalDomains(planner.proposal.operations)
    : { today: false, cycle: false };

  return (
    <section className="ai-planner-view">
      <header className="ai-planner-header">
        <h2>{titleForScreen(planner.screen, planner.launchPresentation.heading)}</h2>
        <IconButton icon={<Settings2 size={17} />} onClick={planner.openConfig}>
          模型设置
        </IconButton>
      </header>
      <AiFlowNav
        screen={planner.screen}
        proposalCount={proposalCount}
        conversationDisabled={!planner.config?.configured}
        onBack={onClose}
        onOpenConversation={planner.openConversation}
        onOpenProposal={planner.openProposal}
      />
      {planner.error ? <div className="ai-inline-error" role="alert">{planner.error}</div> : null}
      <div className="ai-planner-body">
        {planner.screen === "config" ? (
          <AiConfigPanel
            busy={planner.busy}
            config={planner.config}
            connection={planner.configConnection}
            draft={planner.configDraft}
            onFieldChange={planner.changeConfigField}
            onSave={planner.saveConfig}
            onTest={planner.testConnection}
          />
        ) : null}
        {planner.screen === "conversation" ? (
          <AiConversationPanel
            busy={planner.busy}
            composerDraft={planner.composerDraft}
            conversation={planner.conversation}
            modelName={planner.config?.model ?? ""}
            presentation={planner.launchPresentation}
            onComposerChange={planner.changeComposerDraft}
            onSend={planner.sendMessage}
          />
        ) : null}
        {planner.screen === "proposal" && planner.proposal ? (
          <AiProposalPanel
            busy={planner.busy}
            canExecute={canExecute}
            conversation={planner.conversation}
            phase={planner.proposalPhase ?? "pending"}
            proposal={planner.proposal}
            onCancel={planner.discardProposal}
            onConfirm={planner.executeProposal}
            onReturnToConversation={planner.openConversation}
          />
        ) : null}
        {planner.screen === "result" && planner.result ? (
          <AiExecutionPanel
            busy={planner.busy}
            domains={domains}
            result={planner.result}
            onContinue={planner.openConversation}
            onRegenerate={planner.regenerate}
            onViewCycle={() => onNavigate("cycle")}
            onViewToday={() => onNavigate("today")}
          />
        ) : null}
      </div>
    </section>
  );
}

function titleForScreen(screen: string, conversationTitle: string): string {
  if (screen === "config") return "连接模型接口";
  if (screen === "proposal") return "变更提案";
  if (screen === "result") return "执行结果";
  return conversationTitle;
}
