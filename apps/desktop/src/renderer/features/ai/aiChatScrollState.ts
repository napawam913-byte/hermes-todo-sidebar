/**
 * 模块用途：计算 AI 消息列表是否接近底部以及是否显示新回复提示。
 * 模块边界：只处理滚动数值，不持有 React 或 DOM 状态。
 */
export interface ChatScrollGeometry {
  scrollTop: number;
  clientHeight: number;
  scrollHeight: number;
}

const CHAT_BOTTOM_THRESHOLD = 48;

export function isNearChatBottom(geometry: ChatScrollGeometry): boolean {
  const distance = geometry.scrollHeight - geometry.clientHeight - geometry.scrollTop;
  return distance <= CHAT_BOTTOM_THRESHOLD;
}

export function nextUnreadState(input: {
  nearBottom: boolean;
  hasNewMessage: boolean;
}): boolean {
  return input.hasNewMessage && !input.nearBottom;
}
