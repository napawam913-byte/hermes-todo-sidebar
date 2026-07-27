/**
 * 模块用途：验证长对话自动跟随和“跳到最新”判定。
 * 模块边界：只处理滚动几何，不访问 React、DOM 或模型状态。
 */
import { describe, expect, it } from "vitest";
import { isNearChatBottom, nextUnreadState } from "./aiChatScrollState";

describe("AI chat scroll state", () => {
  it("距离底部 48px 内视为正在跟随", () => {
    expect(isNearChatBottom({ scrollTop: 752, clientHeight: 200, scrollHeight: 1_000 })).toBe(true);
    expect(isNearChatBottom({ scrollTop: 700, clientHeight: 200, scrollHeight: 1_000 })).toBe(false);
  });

  it("用户上翻时收到新消息显示未读，回到底部后清除", () => {
    expect(nextUnreadState({ nearBottom: false, hasNewMessage: true })).toBe(true);
    expect(nextUnreadState({ nearBottom: true, hasNewMessage: true })).toBe(false);
    expect(nextUnreadState({ nearBottom: false, hasNewMessage: false })).toBe(false);
  });
});
