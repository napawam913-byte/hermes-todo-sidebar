/**
 * 模块用途：预留 renderer 与 Hermes Agent 之间的主进程桥接接口。
 * 模块边界：当前不注册真实 IPC，不保存模型或飞书密钥。
 */
export interface AgentBridgeIntent {
  intentId: string;
  text: string;
  createdAt: string;
  source: "desktop-sidebar";
}

export interface AgentBridgeResult {
  status: "disabled" | "ready" | "failed";
  proposals: unknown[];
  message?: string;
}

export interface AgentBridge {
  requestProposals(intent: AgentBridgeIntent): Promise<AgentBridgeResult>;
}

export function createDisabledAgentBridge(): AgentBridge {
  return {
    async requestProposals() {
      return {
        status: "disabled",
        proposals: [],
        message: "Agent 主进程桥接尚未连接 Hermes。"
      };
    }
  };
}
