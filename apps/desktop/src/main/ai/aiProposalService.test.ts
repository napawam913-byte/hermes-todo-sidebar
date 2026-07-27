/**
 * 模块用途：验证模型输出会被本地校验、补充提案 ID 和目标版本。
 * 模块边界：使用模型与配置替身，不访问网络、safeStorage 或 IPC。
 */
import { describe, expect, it, vi } from "vitest";
import {
  createEmptyAppState,
  type StoredAppStateV1
} from "../storage/appStateTypes.js";
import { AiProposalService } from "./aiProposalService.js";
import type { AiGenerationContext } from "../../shared/aiMutationTypes.js";

const updatedAt = "2026-07-14T09:00:00.000Z";

function storedState(): StoredAppStateV1 {
  return {
    ...createEmptyAppState(),
    todos: [{
      id: "todo_1", title: "旧待办", date: "2026-07-14", status: "pending",
      syncStatus: "local", source: { type: "manual" }, createdAt: updatedAt,
      updatedAt, snoozeCount: 0
    }],
    cyclePlans: [{
      schemaVersion: 2, id: "plan_1", title: "健身计划", topic: "健身",
      description: "两练", status: "active", source: { type: "manual" },
      createdAt: updatedAt, updatedAt, entries: []
    }]
  };
}

function generateRequest(message: string, context: AiGenerationContext) {
  return { sessionId: "session_test", requestId: `request_${message}`, message, conversation: [], context };
}

describe("AiProposalService", () => {
  it("enriches target operations and never puts the API key in model messages", async () => {
    const getSnapshot = vi.fn(async () => storedState());
    const requestAssistant = vi.fn(async () => JSON.stringify({
      schemaVersion: 1,
      summary: "调整计划",
      operations: [
        { type: "cyclePlan.update", targetId: "plan_1", patch: { title: "新计划" } },
        {
          type: "cyclePlan.entry.create", planId: "plan_1",
          draft: { date: "2026-07-15", title: "训练", contentSummary: "卧推", contentBlocks: [] }
        }
      ]
    }));
    const service = new AiProposalService({
      snapshotPort: { getSnapshot },
      credentials: { getCredentials: async () => ({
        baseUrl: "https://api.example.com/v1", model: "grok-4.5-test", apiKey: "sk-secret"
      }) },
      modelClient: { requestAssistant },
      idFactory: () => "proposal_generated"
    });

    const result = await service.generate(generateRequest(
      "调整我的计划",
      { type: "cyclePlan.adjust", targetPlanId: "plan_1" }
    ));

    expect(result).toMatchObject({
      status: "proposal",
      proposal: {
        proposalId: "proposal_generated",
        operations: [
          { targetId: "plan_1", expectedUpdatedAt: updatedAt },
          { planId: "plan_1", expectedUpdatedAt: updatedAt }
        ]
      }
    });
    expect(JSON.stringify(requestAssistant.mock.calls[0][1])).not.toContain("sk-secret");
    expect(JSON.stringify(requestAssistant.mock.calls[0][1])).toContain("grok-4.5-test");
    expect(JSON.stringify(requestAssistant.mock.calls[0][1])).not.toContain("todo_1");
    expect(JSON.stringify(requestAssistant.mock.calls[0][1])).toContain("plan_1");
    expect(requestAssistant.mock.calls[0][2]).toEqual({
      sessionId: "session_test",
      requestId: "request_调整我的计划"
    });
    expect(getSnapshot).toHaveBeenCalledOnce();
  });

  it("does not call the model when the async snapshot port fails", async () => {
    const requestAssistant = vi.fn();
    const service = new AiProposalService({
      snapshotPort: {
        getSnapshot: async () => {
          throw new Error("snapshot unavailable");
        }
      },
      credentials: {
        getCredentials: async () => ({
          baseUrl: "https://api.example.com/v1",
          model: "model",
          apiKey: "secret"
        })
      },
      modelClient: { requestAssistant }
    });

    await expect(service.generate(generateRequest(
      "创建健身计划",
      { type: "cyclePlan.create" }
    ))).rejects.toThrow("snapshot unavailable");
    expect(requestAssistant).not.toHaveBeenCalled();
  });

  it("returns ordinary Hermes text as a chat message", async () => {
    const service = new AiProposalService({
      snapshotPort: { getSnapshot: async () => storedState() },
      credentials: { getCredentials: async () => ({ baseUrl: "x", model: "m", apiKey: "k" }) },
      modelClient: { requestAssistant: async () => "新手可以先从每周三练开始。" }
    });

    await expect(service.generate(generateRequest(
      "新手一周练几次？",
      { type: "assistant" }
    ))).resolves.toEqual({
      status: "message",
      message: "新手可以先从每周三练开始。"
    });
  });

  it("rejects non-create operations in cycle plan create mode", async () => {
    const service = new AiProposalService({
      snapshotPort: { getSnapshot: async () => storedState() },
      credentials: { getCredentials: async () => ({ baseUrl: "x", model: "m", apiKey: "k" }) },
      modelClient: { requestAssistant: async () => JSON.stringify({
        schemaVersion: 1,
        summary: "错误地创建普通待办",
        operations: [{
          type: "todo.create",
          draft: { title: "训练", date: "2026-07-15" }
        }]
      }) }
    });

    await expect(service.generate(generateRequest(
      "生成健身周期任务",
      { type: "cyclePlan.create" }
    ))).rejects.toThrow("周期任务创建模式只允许创建周期任务");
  });

  it("rejects adjustments that target another cycle plan", async () => {
    const service = new AiProposalService({
      snapshotPort: { getSnapshot: async () => storedState() },
      credentials: { getCredentials: async () => ({ baseUrl: "x", model: "m", apiKey: "k" }) },
      modelClient: { requestAssistant: async () => JSON.stringify({
        schemaVersion: 1,
        summary: "越权修改另一个计划",
        operations: [{
          type: "cyclePlan.update",
          targetId: "plan_other",
          patch: { title: "错误计划" }
        }]
      }) }
    });

    await expect(service.generate(generateRequest(
      "调整健身计划",
      { type: "cyclePlan.adjust", targetPlanId: "plan_1" }
    ))).rejects.toThrow("AI 调整只能修改当前周期任务");
  });
});
