/**
 * 模块用途：在固定字符预算内保留首次目标和最近完整会话。
 * 模块边界：只选择整条消息，不截断内容、不调用模型或存储。
 */
import type { AiConversationTurn } from "../../shared/aiMutationTypes.js";

export const AI_CONVERSATION_CHARACTER_BUDGET = 32_000;

export function selectConversationWithinBudget(
  conversation: AiConversationTurn[],
  budget = AI_CONVERSATION_CHARACTER_BUDGET
): AiConversationTurn[] {
  if (conversation.length === 0 || budget <= 0) return [];
  const firstUser = conversation.findIndex((turn) => turn.role === "user");
  const firstGoalIndex = firstUser < 0 ? 0 : firstUser;
  const selected = new Set<number>([firstGoalIndex]);
  let used = conversation[firstGoalIndex].content.length;

  for (let index = conversation.length - 1; index >= 0; index -= 1) {
    if (selected.has(index)) continue;
    const size = conversation[index].content.length;
    if (used + size > budget) continue;
    selected.add(index);
    used += size;
  }

  return [...selected]
    .sort((left, right) => left - right)
    .map((index) => conversation[index]);
}
