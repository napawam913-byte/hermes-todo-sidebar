/**
 * 模块用途：调用 OpenAI 兼容 chat/completions 并返回 Hermes 最终助手文本。
 * 模块边界：不分类业务响应、不保存配置，也不记录请求或 API Key。
 */
import type { AiModelCredentials } from "./aiConfigTypes.js";
import { AI_MUTATION_RESPONSE_SCHEMA } from "./aiMutationJsonSchema.js";

export const MAX_MODEL_RESPONSE_BYTES = 512 * 1024;

export interface ModelMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiRequestMetadata {
  sessionId: string;
  requestId: string;
}

export class OpenAiCompatibleClient {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async requestAssistant(
    credentials: AiModelCredentials,
    messages: ModelMessage[],
    metadata: AiRequestMetadata
  ): Promise<string> {
    const result = await this.post(credentials, messages, undefined, metadata);
    if (!result.response.ok) throw requestError(result.response.status);
    return parseAssistantContent(result.body);
  }

  // [待删除-2026-07-18] 仅保留旧供应商结构化输出兼容；新 Hermes 流程使用 requestAssistant。
  async requestProposal(
    credentials: AiModelCredentials,
    messages: ModelMessage[]
  ): Promise<unknown> {
    let schemaResult;
    try {
      schemaResult = await this.post(credentials, messages, {
        type: "json_schema",
        json_schema: {
          name: "ai_mutation_proposal",
          strict: true,
          schema: AI_MUTATION_RESPONSE_SCHEMA
        }
      });
    } catch (error) {
      if (!(error instanceof ModelNetworkError)) throw error;
      return this.requestJsonObject(credentials, messages);
    }
    if (schemaResult.response.ok) return parseAssistantJson(schemaResult.body);
    if (schemaResult.response.status !== 400 && schemaResult.response.status !== 422) {
      throw requestError(schemaResult.response.status);
    }
    return this.requestJsonObject(credentials, messages);
  }

  private async requestJsonObject(
    credentials: AiModelCredentials,
    messages: ModelMessage[]
  ): Promise<unknown> {
    const fallback = await this.post(credentials, messages, { type: "json_object" });
    if (!fallback.response.ok) throw requestError(fallback.response.status);
    return parseAssistantJson(fallback.body);
  }

  async testConnection(credentials: AiModelCredentials): Promise<void> {
    const result = await this.post(credentials, [{ role: "user", content: "回复 OK" }]);
    if (!result.response.ok) throw requestError(result.response.status);
  }

  private async post(
    credentials: AiModelCredentials,
    messages: ModelMessage[],
    responseFormat?: Record<string, unknown>,
    metadata?: AiRequestMetadata
  ) {
    const body = {
      model: credentials.model,
      messages,
      temperature: 0.1,
      ...(responseFormat ? { response_format: responseFormat } : {})
    };
    let response: Response;
    try {
      response = await this.fetchImpl(`${credentials.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${credentials.apiKey}`,
          ...(metadata ? {
            "X-Hermes-Session-Id": safeHeader(metadata.sessionId, "sessionId"),
            "X-Hermes-Session-Key": "hermes-todo-sidebar:desktop",
            "Idempotency-Key": safeHeader(metadata.requestId, "requestId")
          } : {})
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60_000)
      });
    } catch (error) {
      throw toModelNetworkError(error);
    }
    const parsed = await readResponseJson(response);
    return { response, body: parsed };
  }
}

async function readResponseJson(response: Response): Promise<unknown> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_MODEL_RESPONSE_BYTES) {
    throw new Error("模型响应过大");
  }
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > MAX_MODEL_RESPONSE_BYTES) {
    throw new Error("模型响应过大");
  }
  try { return JSON.parse(text); } catch { return null; }
}

function parseAssistantContent(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("模型响应格式无效");
  }
  const choices = (value as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) throw new Error("模型未返回内容");
  const first = choices[0] as { message?: { content?: unknown } };
  if (typeof first.message?.content !== "string" || !first.message.content.trim()) {
    throw new Error("模型回复为空");
  }
  return first.message.content.trim();
}

function parseAssistantJson(value: unknown): unknown {
  const content = parseAssistantContent(value)
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  try { return JSON.parse(content); } catch { throw new Error("模型没有返回有效 JSON"); }
}

function safeHeader(value: string, label: string): string {
  if (!value || value.length > 256 || /[\r\n\0]/.test(value)) {
    throw new Error(`${label} 格式无效`);
  }
  return value;
}

function requestError(status: number): Error {
  return new Error(`模型接口请求失败（HTTP ${status}）`);
}

class ModelNetworkError extends Error {}

function toModelNetworkError(error: unknown): ModelNetworkError {
  const code = readNetworkCode(error);
  const suffix = code ? `（${code}）` : "";
  const hint = code === "TIMEOUT"
    ? "请求超时，请稍后重试"
    : "请检查网络、代理或接口服务状态后重试";
  return new ModelNetworkError(`无法连接模型接口${suffix}：${hint}`, { cause: error });
}

function readNetworkCode(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  const record = error as { name?: unknown; code?: unknown; cause?: unknown };
  if (record.name === "TimeoutError" || record.name === "AbortError") return "TIMEOUT";
  if (typeof record.code === "string") return record.code;
  if (record.cause && typeof record.cause === "object") {
    const causeCode = (record.cause as { code?: unknown }).code;
    if (typeof causeCode === "string") return causeCode;
  }
  return "";
}
