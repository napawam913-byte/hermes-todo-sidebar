/**
 * 模块用途：把 preload 暴露的 AI 白名单包装成 renderer 可注入接口。
 * 模块边界：不保存 API Key，不直接访问 ipcRenderer 或模型网络。
 */
import type {
  AiConfigInput,
  AiConfigDraftV1,
  AiConnectionResult,
  AiPublicConfig
} from "../../../shared/aiBridgeContract";
import type {
  AiExecuteResult,
  AiGenerateRequest,
  AiGenerateResult
} from "../../../shared/aiMutationTypes";

export interface AiDesktopBridge {
  getConfig(): Promise<AiPublicConfig>;
  getConfigDraft(): Promise<AiConfigDraftV1 | null>;
  saveConfigDraft(draft: AiConfigDraftV1): Promise<void>;
  clearConfigDraft(): Promise<void>;
  saveConfig(input: AiConfigInput): Promise<AiPublicConfig>;
  testConnection(input: AiConfigInput): Promise<AiConnectionResult>;
  generate(input: AiGenerateRequest): Promise<AiGenerateResult>;
  execute(proposalId: string): Promise<AiExecuteResult>;
  discard(proposalId: string): Promise<boolean>;
}

export function getAiDesktopBridge(): AiDesktopBridge {
  if (window.hermesAi) return window.hermesAi;
  return {
    getConfig: async () => ({ configured: false, baseUrl: "", model: "", maskedApiKey: "" }),
    getConfigDraft: async () => null,
    saveConfigDraft: async () => undefined,
    clearConfigDraft: async () => undefined,
    saveConfig: async () => { throw new Error("请在 Electron 桌面版中配置模型接口"); },
    testConnection: async () => ({ ok: false, message: "浏览器 Demo 不会连接模型接口" }),
    generate: async () => { throw new Error("请在 Electron 桌面版中使用 AI 安排"); },
    execute: async () => ({
      status: "failed",
      code: "validation_failed",
      message: "浏览器 Demo 不执行本地变更"
    }),
    discard: async () => false
  };
}
