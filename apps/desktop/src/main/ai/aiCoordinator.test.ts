/**
 * 模块用途：验证 renderer 只能按主进程保存的 proposalId 执行已预览提案。
 * 模块边界：使用轻量端口替身，不调用网络、磁盘或 Electron IPC。
 */
import { describe, expect, it, vi } from "vitest";
import type { AiMutationProposal } from "../../shared/aiMutationTypes.js";
import { PlanApiError } from "../planApi/planApiErrors.js";
import { AiCoordinator } from "./aiCoordinator.js";

const proposal: AiMutationProposal = {
  schemaVersion: 1,
  proposalId: "proposal_1",
  summary: "新增待办",
  operations: [{ type: "todo.create", draft: { title: "训练", date: "2026-07-15" } }]
};

describe("AiCoordinator", () => {
  it("executes only a pending proposal stored by the main process", async () => {
    const execute = vi.fn(async () => ({ todos: [{ id: "todo_ai" }], cyclePlans: [] }));
    const coordinator = new AiCoordinator({
      configStore: {
        getPublicConfig: async () => ({ configured: true, baseUrl: "url", model: "m", maskedApiKey: "***" }),
        save: async () => ({ configured: true, baseUrl: "url", model: "m", maskedApiKey: "***" }),
        getCredentials: async () => ({ baseUrl: "url", model: "m", apiKey: "secret" })
      },
      proposalService: { generate: async () => ({ status: "proposal", proposal }) },
      executor: { execute },
      connectionClient: { testConnection: async () => undefined }
    });

    await coordinator.generate({ message: "新增训练", conversation: [] });
    const result = await coordinator.execute("proposal_1");

    expect(execute).toHaveBeenCalledWith(proposal);
    expect(result).toMatchObject({ status: "success", operationCount: 1 });
    await expect(coordinator.execute("proposal_1")).resolves.toEqual({
      status: "failed",
      code: "validation_failed",
      message: "提案不存在、已执行或已过期"
    });
  });

  it("keeps the old proposal until a replacement is generated successfully", async () => {
    const replacement = { ...proposal, proposalId: "proposal_2", summary: "调整后提案" };
    const generate = vi.fn()
      .mockResolvedValueOnce({ status: "proposal", proposal })
      .mockResolvedValueOnce({ status: "message", message: "还需要确认训练天数" })
      .mockResolvedValueOnce({ status: "proposal", proposal })
      .mockResolvedValueOnce({ status: "proposal", proposal: replacement });
    const execute = vi.fn(async () => ({ todos: [], cyclePlans: [] }));
    const coordinator = new AiCoordinator({
      configStore: {
        getPublicConfig: async () => ({ configured: true, baseUrl: "url", model: "m", maskedApiKey: "***" }),
        save: async () => ({ configured: true, baseUrl: "url", model: "m", maskedApiKey: "***" }),
        getCredentials: async () => ({ baseUrl: "url", model: "m", apiKey: "secret" })
      },
      proposalService: { generate },
      executor: { execute },
      connectionClient: { testConnection: async () => undefined }
    });

    await coordinator.generate({ message: "初版", conversation: [] });
    await coordinator.generate({
      message: "调整",
      conversation: [],
      supersedesProposalId: "proposal_1"
    });
    expect((await coordinator.execute("proposal_1")).status).toBe("success");

    await coordinator.generate({ message: "初版", conversation: [] });
    await coordinator.generate({
      message: "调整",
      conversation: [],
      supersedesProposalId: "proposal_1"
    });
    await expect(coordinator.execute("proposal_1")).resolves.toMatchObject({ status: "failed" });
    await expect(coordinator.execute("proposal_2")).resolves.toMatchObject({ status: "success" });
  });

  it("discards a pending proposal explicitly", async () => {
    const coordinator = new AiCoordinator({
      configStore: {
        getPublicConfig: async () => ({ configured: true, baseUrl: "url", model: "m", maskedApiKey: "***" }),
        save: async () => ({ configured: true, baseUrl: "url", model: "m", maskedApiKey: "***" }),
        getCredentials: async () => ({ baseUrl: "url", model: "m", apiKey: "secret" })
      },
      proposalService: { generate: async () => ({ status: "proposal", proposal }) },
      executor: { execute: async () => ({ todos: [], cyclePlans: [] }) },
      connectionClient: { testConnection: async () => undefined }
    });

    await coordinator.generate({ message: "新增训练", conversation: [] });
    expect(coordinator.discard("proposal_1")).toBe(true);
    await expect(coordinator.execute("proposal_1")).resolves.toMatchObject({ status: "failed" });
  });

  it("reports Plan API offline failures as persistence failures", async () => {
    const coordinator = new AiCoordinator({
      configStore: {
        getPublicConfig: async () => ({ configured: true, baseUrl: "url", model: "m", maskedApiKey: "***" }),
        save: async () => ({ configured: true, baseUrl: "url", model: "m", maskedApiKey: "***" }),
        getCredentials: async () => ({ baseUrl: "url", model: "m", apiKey: "secret" })
      },
      proposalService: { generate: async () => ({ status: "proposal", proposal }) },
      executor: {
        execute: async () => {
          throw new PlanApiError("offline");
        }
      },
      connectionClient: { testConnection: async () => undefined }
    });

    await coordinator.generate({ message: "新增训练", conversation: [] });
    await expect(coordinator.execute("proposal_1")).resolves.toEqual({
      status: "failed",
      code: "persistence_failed",
      message: "数据服务暂时不可用，请稍后重试"
    });
  });

  it("tests the current form credentials without saving them", async () => {
    const resolveCredentials = vi.fn(async (input) => ({ ...input }));
    const save = vi.fn(async () => ({
      configured: true,
      baseUrl: "https://api.example.com/v1",
      model: "model-current",
      maskedApiKey: "***"
    }));
    const testConnection = vi.fn(async () => undefined);
    const inspect = vi.fn(async () => ({
      provider: "hermes" as const,
      cyclePlanExtension: "unknown" as const
    }));
    const coordinator = new AiCoordinator({
      configStore: {
        getPublicConfig: async () => ({ configured: false, baseUrl: "", model: "", maskedApiKey: "" }),
        save,
        getCredentials: async () => null,
        resolveCredentials
      },
      proposalService: { generate: async () => ({ status: "message", message: "问题" }) },
      executor: { execute: async () => ({ todos: [], cyclePlans: [] }) },
      connectionClient: { testConnection },
      capabilityProbe: { inspect }
    });

    const input = {
      baseUrl: "https://api.example.com/v1",
      model: "model-current",
      apiKey: "sk-current"
    };
    await expect(coordinator.testConnection(input)).resolves.toEqual({
      ok: true,
      message: "Hermes 在线，当前版本无法自动验证周期计划扩展",
      provider: "hermes",
      cyclePlanExtension: "unknown"
    });
    expect(resolveCredentials).toHaveBeenCalledWith(input);
    expect(testConnection).toHaveBeenCalledWith(input);
    expect(inspect).toHaveBeenCalledWith(input);
    expect(save).not.toHaveBeenCalled();
  });

  it("does not report a successful save when the non-secret draft cannot be cleared", async () => {
    const clear = vi.fn(async () => {
      throw new Error("草稿清理失败");
    });
    const coordinator = new AiCoordinator({
      configStore: {
        getPublicConfig: async () => ({ configured: false, baseUrl: "", model: "", maskedApiKey: "" }),
        save: async () => ({
          configured: true,
          baseUrl: "https://api.example.com/v1",
          model: "model",
          maskedApiKey: "***"
        }),
        getCredentials: async () => null,
        resolveCredentials: async (input) => input
      },
      configDraftStore: { load: async () => null, save: async () => undefined, clear },
      proposalService: { generate: async () => ({ status: "message", message: "问题" }) },
      executor: { execute: async () => ({ todos: [], cyclePlans: [] }) },
      connectionClient: { testConnection: async () => undefined }
    });

    await expect(coordinator.saveConfig({
      baseUrl: "https://api.example.com/v1",
      model: "model",
      apiKey: "sk-current"
    })).rejects.toThrow("草稿清理失败");
  });
});
