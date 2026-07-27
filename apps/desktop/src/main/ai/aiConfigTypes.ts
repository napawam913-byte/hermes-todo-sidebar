/**
 * 模块用途：定义模型连接配置的公开视图、写入输入和磁盘格式。
 * 模块边界：API Key 明文只允许出现在主进程凭据对象中。
 */
export type { AiConfigInput, AiPublicConfig } from "../../shared/aiBridgeContract.js";

export interface AiModelCredentials {
  baseUrl: string;
  model: string;
  apiKey: string;
}

export interface StoredAiConfigV1 {
  schemaVersion: 1;
  baseUrl: string;
  model: string;
  apiKeyCiphertext: string;
  updatedAt: string;
}
