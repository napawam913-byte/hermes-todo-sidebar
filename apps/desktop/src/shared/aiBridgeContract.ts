/**
 * 模块用途：定义 preload 白名单两侧共同使用的 AI 配置与执行结果合同。
 * 模块边界：不包含 API Key 读取接口或 Electron 实现。
 */
export interface AiConfigInput {
  baseUrl: string;
  model: string;
  apiKey: string;
}

export interface AiPublicConfig {
  configured: boolean;
  baseUrl: string;
  model: string;
  maskedApiKey: string;
}

export interface AiConfigDraftV1 {
  schemaVersion: 1;
  baseUrl: string;
  model: string;
  updatedAt: string;
}

export type AiConnectionResult =
  | {
      ok: true;
      message: string;
      provider: "hermes" | "openai-compatible";
      cyclePlanExtension: "ready" | "missing" | "unknown";
    }
  | { ok: false; message: string };
