/**
 * 模块用途：通过安全加密端口保存模型配置，并向 renderer 提供脱敏快照。
 * 模块边界：不直接访问 Electron safeStorage 或文件系统，便于独立测试。
 */
import type {
  AiConfigInput,
  AiModelCredentials,
  AiPublicConfig,
  StoredAiConfigV1
} from "./aiConfigTypes.js";

export interface AiConfigPersistence {
  load(): Promise<StoredAiConfigV1 | null>;
  save(config: StoredAiConfigV1): Promise<void>;
}

export interface SecretProtector {
  isAvailable(): boolean;
  encrypt(value: string): Buffer;
  decrypt(value: Buffer): string;
}

export class AiConfigStore {
  constructor(
    private readonly persistence: AiConfigPersistence,
    private readonly protector: SecretProtector,
    private readonly now: () => Date = () => new Date()
  ) {}

  async getPublicConfig(): Promise<AiPublicConfig> {
    const credentials = await this.getCredentials();
    if (!credentials) return emptyPublicConfig();
    return {
      configured: true,
      baseUrl: credentials.baseUrl,
      model: credentials.model,
      maskedApiKey: maskApiKey(credentials.apiKey)
    };
  }

  async getCredentials(): Promise<AiModelCredentials | null> {
    const stored = await this.persistence.load();
    if (!stored) return null;
    if (!this.protector.isAvailable()) throw new Error("系统安全存储当前不可用");
    return {
      baseUrl: stored.baseUrl,
      model: stored.model,
      apiKey: this.protector.decrypt(Buffer.from(stored.apiKeyCiphertext, "base64"))
    };
  }

  async save(input: AiConfigInput): Promise<AiPublicConfig> {
    if (!this.protector.isAvailable()) throw new Error("系统安全存储当前不可用");
    const credentials = await this.resolveCredentials(input);
    const encrypted = this.protector.encrypt(credentials.apiKey).toString("base64");
    await this.persistence.save({
      schemaVersion: 1,
      baseUrl: credentials.baseUrl,
      model: credentials.model,
      apiKeyCiphertext: encrypted,
      updatedAt: this.now().toISOString()
    });
    return {
      configured: true,
      baseUrl: credentials.baseUrl,
      model: credentials.model,
      maskedApiKey: maskApiKey(credentials.apiKey)
    };
  }

  async resolveCredentials(input: AiConfigInput): Promise<AiModelCredentials> {
    const existing = input.apiKey.trim() ? null : await this.getCredentials();
    return normalizeInput({
      ...input,
      apiKey: input.apiKey.trim() || existing?.apiKey || ""
    });
  }
}

function normalizeInput(input: AiConfigInput): AiModelCredentials {
  const baseUrl = input.baseUrl.trim().replace(/\/+$/, "");
  const model = input.model.trim();
  const apiKey = input.apiKey.trim();
  let parsed: URL;
  try { parsed = new URL(baseUrl); } catch { throw new Error("Base URL 格式无效"); }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Base URL 仅支持 HTTP 或 HTTPS");
  }
  if (!model) throw new Error("模型名称不能为空");
  if (!apiKey) throw new Error("API Key 不能为空");
  return { baseUrl, model, apiKey };
}

function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 7) return "••••••";
  return `${apiKey.slice(0, 3)}••••••${apiKey.slice(-4)}`;
}

function emptyPublicConfig(): AiPublicConfig {
  return { configured: false, baseUrl: "", model: "", maskedApiKey: "" };
}
