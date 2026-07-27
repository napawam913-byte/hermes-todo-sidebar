/**
 * 模块用途：验证 AI IPC 只注册白名单通道并对 renderer 输入做边界校验。
 * 模块边界：使用 IPC 与协调器替身，不启动 Electron 窗口。
 */
import type { IpcMain } from "electron";
import { describe, expect, it, vi } from "vitest";
import type { AiCoordinator } from "./aiCoordinator.js";
import { AI_CHANNELS, registerAiIpc } from "./aiIpc.js";

describe("registerAiIpc", () => {
  it("registers config, connection, proposal and id-only execution handlers", async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const ipc = {
      handle(channel: string, listener: (...args: unknown[]) => unknown) {
        handlers.set(channel, listener);
      }
    } as unknown as IpcMain;
    const coordinator = {
      getConfig: vi.fn(async () => ({ configured: false })),
      getConfigDraft: vi.fn(async () => null),
      saveConfigDraft: vi.fn(async (draft) => draft),
      clearConfigDraft: vi.fn(async () => undefined),
      saveConfig: vi.fn(async (input) => ({ configured: true, ...input, apiKey: undefined })),
      testConnection: vi.fn(async () => ({ ok: true, message: "正常" })),
      generate: vi.fn(async (request) => ({ status: "message", message: request.message })),
      execute: vi.fn(async (id) => ({ status: "failed", code: "validation_failed", message: id })),
      discard: vi.fn(() => true)
    } as unknown as AiCoordinator;

    registerAiIpc(ipc, coordinator);

    expect([...handlers.keys()].sort()).toEqual(Object.values(AI_CHANNELS).sort());
    await handlers.get(AI_CHANNELS.saveConfig)?.({}, {
      baseUrl: "https://api.example.com/v1",
      model: "model",
      apiKey: "secret",
      injected: "blocked"
    });
    const draft = {
      schemaVersion: 1,
      baseUrl: "https://api.example.com/v1",
      model: "model",
      updatedAt: "2026-07-17T01:00:00.000Z"
    };
    await handlers.get((AI_CHANNELS as Record<string, string>).saveConfigDraft)?.({}, draft);
    await handlers.get((AI_CHANNELS as Record<string, string>).clearConfigDraft)?.({});
    await handlers.get(AI_CHANNELS.testConnection)?.({}, {
      baseUrl: "https://api.example.com/v1",
      model: "model",
      apiKey: "secret"
    });
    await handlers.get(AI_CHANNELS.generate)?.({}, {
      sessionId: "session_1",
      requestId: "request_1",
      message: "创建计划",
      conversation: [{ role: "user", content: "上下文" }],
      context: { type: "cyclePlan.create" },
      supersedesProposalId: "proposal_old"
    });
    await handlers.get(AI_CHANNELS.execute)?.({}, "proposal_1");
    await handlers.get(AI_CHANNELS.discard)?.({}, "proposal_1");

    expect(coordinator.saveConfig).toHaveBeenCalledWith({
      baseUrl: "https://api.example.com/v1",
      model: "model",
      apiKey: "secret"
    });
    expect(coordinator.execute).toHaveBeenCalledWith("proposal_1");
    expect(coordinator.discard).toHaveBeenCalledWith("proposal_1");
    expect(coordinator.generate).toHaveBeenCalledWith({
      sessionId: "session_1",
      requestId: "request_1",
      message: "创建计划",
      conversation: [{ role: "user", content: "上下文" }],
      context: { type: "cyclePlan.create" },
      supersedesProposalId: "proposal_old"
    });
    expect(coordinator.saveConfigDraft).toHaveBeenCalledWith(draft);
    expect(coordinator.clearConfigDraft).toHaveBeenCalledOnce();
    expect(coordinator.testConnection).toHaveBeenCalledWith({
      baseUrl: "https://api.example.com/v1",
      model: "model",
      apiKey: "secret"
    });
  });

  it("rejects secret or unknown fields in a config draft", async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const ipc = { handle: (channel: string, listener: (...args: unknown[]) => unknown) => {
      handlers.set(channel, listener);
    } } as unknown as IpcMain;
    const coordinator = { saveConfigDraft: vi.fn() } as unknown as AiCoordinator;
    registerAiIpc(ipc, coordinator);

    const channel = (AI_CHANNELS as Record<string, string>).saveConfigDraft;
    await expect(handlers.get(channel)?.({}, {
      schemaVersion: 1,
      baseUrl: "https://api.example.com/v1",
      model: "model",
      updatedAt: "2026-07-17T01:00:00.000Z",
      apiKey: "must-not-persist"
    })).rejects.toThrow(/字段/);
    expect(coordinator.saveConfigDraft).not.toHaveBeenCalled();
  });

  it("rejects adjustment requests without a target plan id", async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const ipc = { handle: (channel: string, listener: (...args: unknown[]) => unknown) => {
      handlers.set(channel, listener);
    } } as unknown as IpcMain;
    const coordinator = { generate: vi.fn() } as unknown as AiCoordinator;
    registerAiIpc(ipc, coordinator);

    await expect(handlers.get(AI_CHANNELS.generate)?.({}, {
      sessionId: "session_1",
      requestId: "request_1",
      message: "调整计划",
      conversation: [],
      context: { type: "cyclePlan.adjust" }
    })).rejects.toThrow("目标周期任务 ID");
    expect(coordinator.generate).not.toHaveBeenCalled();
  });

  it("rejects unknown fields in generation context", async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const ipc = { handle: (channel: string, listener: (...args: unknown[]) => unknown) => {
      handlers.set(channel, listener);
    } } as unknown as IpcMain;
    const coordinator = { generate: vi.fn() } as unknown as AiCoordinator;
    registerAiIpc(ipc, coordinator);

    await expect(handlers.get(AI_CHANNELS.generate)?.({}, {
      sessionId: "session_1",
      requestId: "request_1",
      message: "创建计划",
      conversation: [],
      context: { type: "cyclePlan.create", injected: "blocked" }
    })).rejects.toThrow("AI 生成上下文字段无效");
    expect(coordinator.generate).not.toHaveBeenCalled();
  });

  it("rejects oversized prompts before they reach the model", async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const ipc = { handle: (channel: string, listener: (...args: unknown[]) => unknown) => {
      handlers.set(channel, listener);
    } } as unknown as IpcMain;
    const coordinator = { generate: vi.fn() } as unknown as AiCoordinator;
    registerAiIpc(ipc, coordinator);

    await expect(handlers.get(AI_CHANNELS.generate)?.({}, {
      sessionId: "session_1",
      requestId: "request_1",
      message: "x".repeat(8001),
      conversation: []
    })).rejects.toThrow(/过长/);
    expect(coordinator.generate).not.toHaveBeenCalled();
  });

  it("accepts more than twelve turns and forwards a budgeted history", async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const ipc = { handle: (channel: string, listener: (...args: unknown[]) => unknown) => {
      handlers.set(channel, listener);
    } } as unknown as IpcMain;
    const coordinator = {
      generate: vi.fn(async () => ({ status: "message", message: "继续" }))
    } as unknown as AiCoordinator;
    registerAiIpc(ipc, coordinator);
    const conversation = Array.from({ length: 20 }, (_, index) => ({
      role: index % 2 === 0 ? "user" : "assistant",
      content: `消息 ${index}`
    }));

    await handlers.get(AI_CHANNELS.generate)?.({}, {
      sessionId: "session_1",
      requestId: "request_1",
      message: "继续规划",
      conversation,
      context: { type: "cyclePlan.create" }
    });

    expect(coordinator.generate).toHaveBeenCalledWith(expect.objectContaining({ conversation }));
  });

  it("accepts the exact general assistant context and request identifiers", async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const ipc = { handle: (channel: string, listener: (...args: unknown[]) => unknown) => {
      handlers.set(channel, listener);
    } } as unknown as IpcMain;
    const coordinator = {
      generate: vi.fn(async () => ({ status: "message", message: "你好" }))
    } as unknown as AiCoordinator;
    registerAiIpc(ipc, coordinator);

    await handlers.get(AI_CHANNELS.generate)?.({}, {
      sessionId: "session_assistant",
      requestId: "request_assistant",
      message: "你好",
      conversation: [],
      context: { type: "assistant" }
    });

    expect(coordinator.generate).toHaveBeenCalledWith({
      sessionId: "session_assistant",
      requestId: "request_assistant",
      message: "你好",
      conversation: [],
      context: { type: "assistant" }
    });
  });
});
