/**
 * 模块用途：验证 Figma AI Flow 的导航、成功入口和失败恢复文案。
 * 模块边界：使用静态 HTML，不调用 IPC 或运行交互事件。
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AiExecutionPanel } from "./AiExecutionPanel";
import { AiFlowNav } from "./AiFlowNav";
import { AiProposalPanel } from "./AiProposalPanel";

const noop = () => undefined;
const proposal = { schemaVersion: 1 as const, proposalId: "proposal-1", summary: "新增计划", operations: [] };

describe("AI Flow 视图", () => {
  it("显示对话与提案数量二级导航", () => {
    const html = renderToStaticMarkup(
      <AiFlowNav
        screen="proposal"
        proposalCount={4}
        onBack={noop}
        onOpenConversation={noop}
        onOpenProposal={noop}
      />
    );
    expect(html).toContain("周期任务");
    expect(html).toContain("对话");
    expect(html).toContain("提案 4");
  });

  it("API 未配置时禁用对话入口", () => {
    const html = renderToStaticMarkup(
      <AiFlowNav
        screen="config"
        proposalCount={0}
        conversationDisabled
        onBack={noop}
        onOpenConversation={noop}
        onOpenProposal={noop}
      />
    );
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>对话<\/button>/);
  });

  it("混合提案成功后提供两个数据入口", () => {
    const html = renderToStaticMarkup(
      <AiExecutionPanel
        busy={false}
        domains={{ today: true, cycle: true }}
        result={{
          status: "success",
          summary: "已完成",
          operationCount: 4,
          state: { todos: [], cyclePlans: [] }
        }}
        onContinue={noop}
        onRegenerate={noop}
        onRetry={noop}
        onViewCycle={noop}
        onViewToday={noop}
      />
    );
    expect(html).toContain("查看今日待办");
    expect(html).toContain("查看周期任务");
    expect(html).toContain("继续调整");
  });

  it("失败结果明确整批回滚并提供两种恢复动作", () => {
    const html = renderToStaticMarkup(
      <AiExecutionPanel
        busy={false}
        domains={{ today: false, cycle: true }}
        result={{ status: "failed", code: "version_conflict", message: "数据已变化" }}
        onContinue={noop}
        onRegenerate={noop}
        onRetry={noop}
        onViewCycle={noop}
        onViewToday={noop}
      />
    );
    expect(html).toContain("整批已回滚");
    expect(html).toContain("刷新并重新生成");
    expect(html).toContain("返回对话");
  });

  it("持久化失败允许用原提案重试且不声称已经回滚", () => {
    const html = renderToStaticMarkup(
      <AiExecutionPanel
        busy={false}
        domains={{ today: false, cycle: true }}
        result={{ status: "failed", code: "persistence_failed", message: "连接中断" }}
        onContinue={noop}
        onRegenerate={noop}
        onRetry={noop}
        onViewCycle={noop}
        onViewToday={noop}
      />
    );

    expect(html).toContain("写入结果待确认");
    expect(html).toContain("重试执行");
    expect(html).not.toContain("整批已回滚");
    expect(html).not.toContain("刷新并重新生成");
  });

  it("blocks proposal execution while offline but keeps discard available", () => {
    const html = renderToStaticMarkup(
      <AiProposalPanel
        busy={false}
        canExecute={false}
        conversation={[]}
        phase="pending"
        proposal={proposal}
        onCancel={noop}
        onConfirm={noop}
        onReturnToConversation={noop}
      />
    );

    expect(html).toContain("数据服务离线，提案暂不能写入");
    expect(html).toMatch(/<button[^>]*>[^<]*<span>放弃草稿<\/span><\/button>/);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>[^<]*<span>确认执行 0 项<\/span>/);
  });
});
