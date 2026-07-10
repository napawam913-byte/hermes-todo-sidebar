/**
 * 模块用途：定义桌面端请求 Agent 建议的客户端接口，并提供禁用态占位实现。
 * 模块边界：当前不联网、不调用模型；未来真实推理由 Hermes 云端承接。
 */
import type { AgentIntent, AgentProposalResult } from "./agentTypes";

export interface AgentClient {
  requestProposals(intent: AgentIntent): Promise<AgentProposalResult>;
}

export function createDisabledAgentClient(): AgentClient {
  return {
    async requestProposals() {
      return {
        status: "disabled",
        proposals: [],
        message: "Agent 尚未启用，当前只保留桌面端扩展接口。"
      };
    }
  };
}
