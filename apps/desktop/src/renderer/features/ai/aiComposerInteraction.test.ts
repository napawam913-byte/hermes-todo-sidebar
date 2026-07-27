/**
 * 模块用途：验证 AI 输入框的发送按键和自适应高度规则。
 * 模块边界：只测试纯交互判断，不渲染 React 或访问 DOM。
 */
import { describe, expect, it } from "vitest";
import { clampComposerHeight, shouldSubmitComposer } from "./aiComposerInteraction";

describe("AI composer interaction", () => {
  it("Enter 发送，Shift+Enter 和输入法组合期间不发送", () => {
    expect(shouldSubmitComposer({ key: "Enter", shiftKey: false, isComposing: false })).toBe(true);
    expect(shouldSubmitComposer({ key: "Enter", shiftKey: true, isComposing: false })).toBe(false);
    expect(shouldSubmitComposer({ key: "Enter", shiftKey: false, isComposing: true })).toBe(false);
  });

  it("输入高度限制在 44px 到 120px", () => {
    expect(clampComposerHeight(20)).toBe(44);
    expect(clampComposerHeight(92)).toBe(92);
    expect(clampComposerHeight(240)).toBe(120);
  });
});
