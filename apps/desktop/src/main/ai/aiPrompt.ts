/**
 * 模块用途：按助手场景整理最小本地上下文和供应商无关的模型消息。
 * 模块边界：普通聊天不发送本地业务数据；本模块不调用网络或信任模型输出。
 */
import type { AiGenerateRequest } from "../../shared/aiMutationTypes.js";
import type { StoredAppStateV1 } from "../storage/appStateTypes.js";
import { selectConversationWithinBudget } from "./aiConversationBudget.js";
import type { ModelMessage } from "./openAiCompatibleClient.js";
import { readStoredPlans } from "./storedDomainValidation.js";

const BASE_PROMPT = `你是桌面待办中的通用 Hermes 助手。普通聊天直接返回简洁自然语言，不要包装成 JSON。
只有用户明确要求创建、制定、生成、安排或调整周期计划时，才加载 cycle-plan Skill 并调用可用的周期计划提案工具。
如果工具返回提案，最终回复必须只包含工具返回的 AiMutationProposal v1 JSON，不要添加代码围栏、前言或后记。
提案外层必须且只能是 {"schemaVersion":1,"summary":"自然语言摘要","operations":[]}；不要使用 version、proposal 或其他包装字段。
第一版只使用 YYYY-MM-DD 日期，不生成具体时间、提醒或自动执行。
只能引用上下文中存在的 targetId 或 planId；不要生成数据库 ID、时间戳、来源和 proposalId。
创建全新周期计划时，把初始日期条目放进 cyclePlan.create.draft.entries，不要引用尚不存在的 planId。
contentBlocks 使用 kind、title、format、data；仅 data 可以自由扩展。
探讨方案、询问规则、非计划相关问题时保持普通聊天。缺少关键信息时每次只追问一个明确问题。
不要声称计划已经保存；工具只能生成待桌面端确认的提案。
单批最多 50 项操作。永久删除不可恢复，必须在 summary 中明确说明。`;

export function buildAiMessages(
  state: StoredAppStateV1,
  request: AiGenerateRequest,
  now = new Date(),
  configuredModel = ""
): ModelMessage[] {
  const context = JSON.stringify(buildScopedContext(state, request, now));
  const modelStatus = configuredModel
    ? `当前应用实际调用的配置模型为 ${configuredModel}。不要根据自身声明猜测或更改模型名称。`
    : "模型名称由应用配置展示，不需要在回答中自我声明。";
  return [
    { role: "system", content: `${BASE_PROMPT}\n${modelStatus}\n${buildGenerationPolicy(request)}` },
    { role: "system", content: `本次最小上下文：${context}` },
    ...selectConversationWithinBudget(request.conversation),
    { role: "user", content: request.message.trim() }
  ];
}

function buildGenerationPolicy(request: AiGenerateRequest): string {
  const context = request.context;
  if (context.type === "assistant") {
    return "此次为普通聊天入口。保持自然对话；明确创建计划时只允许返回 cyclePlan.create 提案，不能调整已有计划或操作普通待办。";
  }
  if (context.type === "cyclePlan.create") {
    return "此次为周期任务创建模式，只允许返回 cyclePlan.create；所有日期条目必须放在 draft.entries。";
  }
  return `此次为周期任务调整模式，目标计划 ID 为 ${context.targetPlanId}。只能修改该计划及其条目，不能修改其他周期任务、创建新计划或操作普通待办。`;
}

function buildScopedContext(
  state: StoredAppStateV1,
  request: AiGenerateRequest,
  now: Date
): Record<string, unknown> {
  const currentDate = toLocalDateKey(now);
  if (request.context.type !== "cyclePlan.adjust") return { currentDate };
  const targetPlanId = request.context.targetPlanId;
  const targetPlan = readStoredPlans(state.cyclePlans)
    .find((plan) => plan.id === targetPlanId) ?? null;
  return { currentDate, targetPlan };
}

function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
