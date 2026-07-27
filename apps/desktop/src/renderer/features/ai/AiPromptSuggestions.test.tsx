/**
 * 模块用途：验证 AI 空状态建议只选择文本，不触发表单提交或模型请求。
 * 模块边界：只检查建议组件的回调与按钮语义，不访问会话状态、IPC 或网络。
 */
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AiPromptSuggestions } from "./AiPromptSuggestions";

describe("AiPromptSuggestions", () => {
  it("使用普通按钮展示建议，不作为提交按钮", () => {
    const html = renderToStaticMarkup(
      <AiPromptSuggestions
        suggestions={["制定四周健身计划"]}
        onSelect={() => undefined}
      />
    );

    expect(html).toContain('type="button"');
    expect(html).not.toContain('type="submit"');
  });

  it("点击建议只把文本交给选择回调", () => {
    const onSelect = vi.fn();
    const tree = AiPromptSuggestions({
      suggestions: ["制定四周健身计划"],
      onSelect
    });
    const button = (tree.props.children as ReactElement<{ onClick(): void }>[]) [0];

    button.props.onClick();

    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith("制定四周健身计划");
  });
});
