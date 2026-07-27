/**
 * 模块用途：锁定 AI 对话与变更提案在宽窄面板中的响应式布局约束。
 * 模块边界：只检查样式结构，不测试浏览器像素渲染。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("AI 安排响应式布局", () => {
  it("AI 对话使用全宽单栏并保留独立消息滚动", () => {
    const globalCss = readFileSync(new URL("./global.css", import.meta.url), "utf8");
    const rendererEntry = readFileSync(new URL("../main.tsx", import.meta.url), "utf8");
    const plannerCss = readFileSync(new URL("./ai-planner.css", import.meta.url), "utf8");
    const conversationCss = readFileSync(new URL("./ai-conversation.css", import.meta.url), "utf8");
    const composerCss = readFileSync(new URL("./ai-composer.css", import.meta.url), "utf8");
    const flowNavCss = readFileSync(new URL("./ai-flow-nav.css", import.meta.url), "utf8");
    const proposalCss = readFileSync(new URL("./ai-proposal.css", import.meta.url), "utf8");
    const conversationView = readFileSync(
      new URL("../features/ai/AiConversationPanel.tsx", import.meta.url),
      "utf8"
    );
    const plannerView = readFileSync(
      new URL("../features/ai/AiPlannerView.tsx", import.meta.url),
      "utf8"
    );

    expect(globalCss).toContain('@import "./ai-planner.css"');
    expect(globalCss).toContain('@import "./ai-proposal.css"');
    expect(globalCss).toContain('@import "./ai-flow-nav.css"');
    expect(globalCss).toContain('@import "./ai-execution.css"');
    expect(globalCss).toContain('@import "./ai-composer.css"');
    expect(rendererEntry).toContain('import "./styles/ai-onboarding.css"');
    expect(rendererEntry).toContain('import "./styles/responsive-panel.css"');
    expect(proposalCss).toContain("minmax(0, 36fr) minmax(0, 64fr)");
    expect(`${plannerCss}\n${proposalCss}`).toContain("@media (max-width: 719px)");
    expect(`${plannerCss}\n${proposalCss}`).not.toContain("width: 360px");
    expect(plannerCss).toContain(".ai-planner-body");
    expect(conversationCss).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(conversationCss).not.toContain("minmax(220px, 3fr)");
    expect(conversationCss).toContain("overflow-y: scroll");
    expect(conversationCss).toContain("scrollbar-gutter: stable");
    expect(conversationView).toContain("AiScopePopover");
    expect(conversationView).not.toContain("AiTaskContext");
    expect(composerCss).toContain("min-height: 44px");
    expect(composerCss).toContain("max-height: 120px");
    expect(composerCss).not.toContain(".ai-composer-label");
    expect(composerCss).toContain("grid-row: 3");
    expect(flowNavCss).toContain("grid-template-columns: auto minmax(72px, 1fr) minmax(72px, 1fr)");
    expect(flowNavCss).toContain("background: var(--ui-accent-soft)");
    expect(plannerView).not.toContain("<p>AI 安排</p>");
  });

  it("今日待办通过同一 DOM 主从容器适配宽窄布局", () => {
    const todoPanelCss = readFileSync(new URL("./todo-panel.css", import.meta.url), "utf8");
    const responsiveCss = readFileSync(
      new URL("./responsive-panel.css", import.meta.url),
      "utf8"
    );
    const todayView = readFileSync(
      new URL("../features/todos/TodayTodoView.tsx", import.meta.url),
      "utf8"
    );
    const listPane = readFileSync(
      new URL("../features/todos/TodayTodoListPane.tsx", import.meta.url),
      "utf8"
    );

    expect(todoPanelCss).toContain(".today-todo-view");
    expect(todoPanelCss).toContain("flex-direction: column");
    expect(todoPanelCss).not.toContain(".panel-surface > :not([hidden])");
    expect(todayView).toContain("ResponsiveMasterDetail");
    expect(todayView).toContain("TodayTodoListPane");
    expect(listPane).toContain('className="today-todo-view"');
    expect(responsiveCss).toContain("@container (min-width: 720px)");
    expect(responsiveCss).toContain("minmax(280px, 2fr) minmax(0, 3fr)");
    expect(responsiveCss).toContain("max-width: 760px");
  });
});
