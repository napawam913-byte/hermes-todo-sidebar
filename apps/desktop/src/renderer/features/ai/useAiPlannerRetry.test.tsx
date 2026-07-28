// @vitest-environment jsdom
/**
 * 模块用途：验证 AI 提案在不确定写入失败后复用原 ID 重试。
 * 模块边界：只使用 preload 白名单替身，不调用真实 Electron 或模型网络。
 */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AiDesktopBridge } from "./aiBridge";
import {
  useAiPlanner,
  type AiPlannerController,
} from "./useAiPlanner";

const proposal = {
  schemaVersion: 1 as const,
  proposalId: "proposal-retry-1",
  summary: "创建健身计划",
  operations: [],
};

describe("useAiPlanner 提案重试", () => {
  afterEach(() => {
    Reflect.deleteProperty(window, "hermesAi");
  });

  it("持久化失败后再次执行仍使用同一 proposalId，成功后停止执行", async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce({
        status: "failed",
        code: "persistence_failed",
        message: "响应中断",
      })
      .mockResolvedValueOnce({
        status: "success",
        summary: proposal.summary,
        operationCount: 0,
        state: { todos: [], cyclePlans: [] },
      });
    const bridge = createBridge(execute);
    Object.defineProperty(window, "hermesAi", {
      configurable: true,
      value: bridge,
    });
    let planner: AiPlannerController | null = null;
    const root = createRoot(document.createElement("div"));
    (globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean;
    }).IS_REACT_ACT_ENVIRONMENT = true;

    function Probe() {
      planner = useAiPlanner({ onStateApplied: vi.fn() });
      return null;
    }

    await act(async () => {
      root.render(<Probe />);
      await Promise.resolve();
    });
    await act(async () => {
      await current(planner).sendMessage("制定四周健身计划");
    });
    await act(async () => {
      await current(planner).executeProposal();
    });

    expect(current(planner).proposalPhase).toBe("pending");
    expect(current(planner).result?.status).toBe("failed");

    await act(async () => {
      await current(planner).executeProposal();
    });
    expect(execute).toHaveBeenNthCalledWith(1, proposal.proposalId);
    expect(execute).toHaveBeenNthCalledWith(2, proposal.proposalId);
    expect(current(planner).proposalPhase).toBe("success");

    await act(async () => {
      await current(planner).executeProposal();
      root.unmount();
    });
    expect(execute).toHaveBeenCalledTimes(2);
  });
});

function createBridge(execute: AiDesktopBridge["execute"]): AiDesktopBridge {
  return {
    getConfig: async () => ({
      configured: true,
      baseUrl: "http://127.0.0.1:8642/v1",
      model: "hermes-agent",
      maskedApiKey: "已配置",
    }),
    getConfigDraft: async () => null,
    saveConfigDraft: async () => undefined,
    clearConfigDraft: async () => undefined,
    saveConfig: async () => {
      throw new Error("unused");
    },
    testConnection: async () => ({ ok: false, message: "unused" }),
    generate: async () => ({ status: "proposal", proposal }),
    execute,
    discard: async () => true,
  };
}

function current(
  planner: AiPlannerController | null,
): AiPlannerController {
  if (!planner) throw new Error("Planner is not mounted");
  return planner;
}
