/**
 * 模块用途：注册 renderer 可调用的 AI 配置、提案和确认执行白名单 IPC。
 * 模块边界：只解析有限输入并转发协调器，不暴露凭据或 BrowserWindow。
 */
import type { IpcMain } from "electron";
import type { AiConfigDraftV1, AiConfigInput } from "../../shared/aiBridgeContract.js";
import type {
  AiGenerationContext,
  AiGenerateRequest
} from "../../shared/aiMutationTypes.js";
import type { AiCoordinator } from "./aiCoordinator.js";
import { selectConversationWithinBudget } from "./aiConversationBudget.js";

export const AI_CHANNELS = {
  getConfig: "ai:get-config",
  getConfigDraft: "ai:get-config-draft",
  saveConfigDraft: "ai:save-config-draft",
  clearConfigDraft: "ai:clear-config-draft",
  saveConfig: "ai:save-config",
  testConnection: "ai:test-connection",
  generate: "ai:generate",
  execute: "ai:execute",
  discard: "ai:discard"
} as const;

export function registerAiIpc(ipc: IpcMain, coordinator: AiCoordinator): void {
  ipc.handle(AI_CHANNELS.getConfig, async () => coordinator.getConfig());
  ipc.handle(AI_CHANNELS.getConfigDraft, async () => coordinator.getConfigDraft());
  ipc.handle(AI_CHANNELS.saveConfigDraft, async (_event, input: unknown) =>
    coordinator.saveConfigDraft(parseConfigDraft(input))
  );
  ipc.handle(AI_CHANNELS.clearConfigDraft, async () => coordinator.clearConfigDraft());
  ipc.handle(AI_CHANNELS.saveConfig, async (_event, input: unknown) =>
    coordinator.saveConfig(parseConfigInput(input))
  );
  ipc.handle(AI_CHANNELS.testConnection, async (_event, input: unknown) =>
    coordinator.testConnection(parseConfigInput(input))
  );
  ipc.handle(AI_CHANNELS.generate, async (_event, input: unknown) =>
    coordinator.generate(parseGenerateRequest(input))
  );
  ipc.handle(AI_CHANNELS.execute, async (_event, proposalId: unknown) =>
    coordinator.execute(readString(proposalId, "proposalId", 200))
  );
  ipc.handle(AI_CHANNELS.discard, async (_event, proposalId: unknown) =>
    coordinator.discard(readString(proposalId, "proposalId", 200))
  );
}

function parseConfigInput(value: unknown): AiConfigInput {
  const input = asRecord(value, "模型配置格式无效");
  return {
    baseUrl: readString(input.baseUrl, "Base URL", 2048),
    model: readString(input.model, "模型名称", 256),
    apiKey: readString(input.apiKey, "API Key", 4096)
  };
}

function parseGenerateRequest(value: unknown): AiGenerateRequest {
  const input = asRecord(value, "AI 请求格式无效");
  const sessionId = readHeaderToken(input.sessionId, "会话 ID");
  const requestId = readHeaderToken(input.requestId, "请求 ID");
  const message = readString(input.message, "输入内容", 8000);
  if (!Array.isArray(input.conversation) || input.conversation.length > 256) {
    throw new Error("对话上下文格式无效或过长");
  }
  const conversation = input.conversation.map((item) => {
    const turn = asRecord(item, "对话消息格式无效");
    if (turn.role !== "user" && turn.role !== "assistant") throw new Error("对话角色无效");
    const role: "user" | "assistant" = turn.role === "user" ? "user" : "assistant";
    return { role, content: readString(turn.content, "对话内容", 8000) };
  });
  const supersedesProposalId = input.supersedesProposalId === undefined
    ? undefined
    : readString(input.supersedesProposalId, "旧提案 ID", 200);
  return {
    sessionId,
    requestId,
    message,
    conversation: selectConversationWithinBudget(conversation),
    context: parseGenerationContext(input.context),
    ...(supersedesProposalId ? { supersedesProposalId } : {})
  };
}

function parseConfigDraft(value: unknown): AiConfigDraftV1 {
  const input = asRecord(value, "模型配置草稿格式无效");
  assertExactConfigDraftKeys(input);
  if (input.schemaVersion !== 1) throw new Error("模型配置草稿版本无效");
  const updatedAt = readString(input.updatedAt, "更新时间", 64);
  if (!Number.isFinite(Date.parse(updatedAt))) throw new Error("更新时间格式无效");
  return {
    schemaVersion: 1,
    baseUrl: readString(input.baseUrl, "Base URL", 2048),
    model: readString(input.model, "模型名称", 256),
    updatedAt
  };
}

function assertExactConfigDraftKeys(value: Record<string, unknown>): void {
  const allowed = ["schemaVersion", "baseUrl", "model", "updatedAt"];
  if (Object.keys(value).length !== allowed.length
    || Object.keys(value).some((key) => !allowed.includes(key))) {
    throw new Error("模型配置草稿字段无效");
  }
}

function parseGenerationContext(value: unknown): AiGenerationContext {
  const context = asRecord(value, "AI 生成上下文格式无效");
  if (context.type === "assistant") {
    assertExactKeys(context, ["type"]);
    return { type: "assistant" };
  }
  if (context.type === "cyclePlan.create") {
    assertExactKeys(context, ["type"]);
    return { type: "cyclePlan.create" };
  }
  if (context.type === "cyclePlan.adjust") {
    assertExactKeys(context, ["type", "targetPlanId"]);
    return {
      type: "cyclePlan.adjust",
      targetPlanId: readString(context.targetPlanId, "目标周期任务 ID", 200)
    };
  }
  throw new Error("AI 生成上下文类型无效");
}

function readHeaderToken(value: unknown, label: string): string {
  const token = readString(value, label, 200);
  if (!token || /[\r\n\0]/.test(token)) throw new Error(`${label}格式无效`);
  return token;
}

function assertExactKeys(value: Record<string, unknown>, allowed: string[]): void {
  if (Object.keys(value).some((key) => !allowed.includes(key))) {
    throw new Error("AI 生成上下文字段无效");
  }
}

function readString(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== "string") throw new Error(`${label}必须是字符串`);
  if (value.length > maxLength) throw new Error(`${label}过长`);
  return value;
}

function asRecord(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(message);
  return value as Record<string, unknown>;
}
