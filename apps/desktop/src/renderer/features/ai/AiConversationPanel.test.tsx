/**
 * 模块用途：验证 AI 对话页展示真实配置模型、固定输入区和按需操作范围入口。
 * 模块边界：使用静态 HTML，不执行滚动、IPC 或网络请求。
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AiConversationPanel } from "./AiConversationPanel";

describe("AiConversationPanel", () => {
  it("展示配置模型名称、消息滚动区和受控输入草稿", () => {
    const html = renderToStaticMarkup(
      <AiConversationPanel
        busy={false}
        composerDraft="继续完善训练计划"
        conversation={[
          { role: "user", content: "帮我安排健身计划" },
          { role: "assistant", content: "你希望每周训练几次？" }
        ]}
        modelName="grok-4.5"
        presentation={{
          heading: "创建周期计划",
          chatTitle: "开始规划",
          emptyTitle: "告诉我你想完成什么",
          emptyDescription: "描述目标后生成提案。",
          placeholder: "描述你的目标",
          suggestions: ["制定四周健身计划"],
          contextLabel: "新建周期任务",
          composerSeed: ""
        }}
        onComposerChange={() => undefined}
        onSend={() => undefined}
      />
    );

    expect(html).toContain("已连接 · grok-4.5");
    expect(html).toContain("开始规划");
    expect(html).toContain("ai-chat-list");
    expect(html).toContain("ai-composer-dock");
    expect(html).toContain("继续完善训练计划");
    expect(html).toContain("操作范围");
    expect(html).not.toContain("任务上下文");
    expect(html).not.toContain("updatedAt");
    expect(html).not.toContain("告诉我你想完成什么");
  });

  it("空对话展示聚焦引导和可编辑建议", () => {
    const html = renderToStaticMarkup(
      <AiConversationPanel
        busy={false}
        composerDraft=""
        conversation={[]}
        modelName="hermes-agent"
        presentation={{
          heading: "创建周期计划",
          chatTitle: "开始规划",
          emptyTitle: "告诉我你想完成什么",
          emptyDescription: "描述目标后生成提案。",
          placeholder: "描述你的目标",
          suggestions: ["制定四周健身计划", "拆分七天学习计划"] ,
          contextLabel: "新建周期任务",
          composerSeed: ""
        }}
        onComposerChange={() => undefined}
        onSend={() => undefined}
      />
    );

    expect(html).toContain("告诉我你想完成什么");
    expect(html).toContain("制定四周健身计划");
    expect(html).toContain('type="button"');
    expect(html).not.toContain("ai-empty-chat");
  });
});
