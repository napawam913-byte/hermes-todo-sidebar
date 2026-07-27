/**
 * 模块用途：锁定 API 配置草稿的恢复、连接状态失效和保存后清密钥规则。
 * 模块边界：只测试纯状态转换，不调用 React、IPC 或磁盘。
 */
import { describe, expect, it } from "vitest";

describe("AiConfigDraftState", () => {
  it("restores non-secret draft fields without restoring an API key", async () => {
    const module = await import("./aiConfigDraftState").catch(() => null);
    expect(module).not.toBeNull();
    if (!module) return;

    const state = module.reduceAiConfigDraftState(module.createAiConfigDraftState(), {
      type: "draft.hydrated",
      config: {
        configured: false,
        baseUrl: "",
        model: "",
        maskedApiKey: ""
      },
      draft: {
        schemaVersion: 1,
        baseUrl: "https://api.example.com/v1",
        model: "model-draft",
        updatedAt: "2026-07-17T01:00:00.000Z"
      }
    });

    expect(state.fields).toEqual({
      baseUrl: "https://api.example.com/v1",
      model: "model-draft",
      apiKey: ""
    });
    expect(state.restoredFromDisk).toBe(true);
  });

  it("invalidates a previous connection result when any field changes", async () => {
    const module = await import("./aiConfigDraftState").catch(() => null);
    expect(module).not.toBeNull();
    if (!module) return;
    const connected = module.reduceAiConfigDraftState(module.createAiConfigDraftState(), {
      type: "connection.finished",
      result: {
        ok: true,
        message: "模型连接正常",
        provider: "openai-compatible",
        cyclePlanExtension: "unknown"
      }
    });

    const changed = module.reduceAiConfigDraftState(connected, {
      type: "field.changed",
      field: "apiKey",
      value: "sk-new"
    });

    expect(changed.connection).toEqual({ status: "idle", message: "" });
  });

  it("clears the plaintext key after a successful save", async () => {
    const module = await import("./aiConfigDraftState").catch(() => null);
    expect(module).not.toBeNull();
    if (!module) return;
    const withKey = module.reduceAiConfigDraftState(module.createAiConfigDraftState(), {
      type: "field.changed",
      field: "apiKey",
      value: "sk-plaintext"
    });

    const saved = module.reduceAiConfigDraftState(withKey, {
      type: "save.succeeded",
      config: {
        configured: true,
        baseUrl: "https://api.example.com/v1",
        model: "model-v1",
        maskedApiKey: "sk-••••••text"
      }
    });

    expect(saved.fields.apiKey).toBe("");
    expect(saved.nonSecretDirty).toBe(false);
    expect(saved.restoredFromDisk).toBe(false);
  });

  it("keeps input typed before asynchronous hydration completes", async () => {
    const module = await import("./aiConfigDraftState").catch(() => null);
    expect(module).not.toBeNull();
    if (!module) return;
    const withKey = module.reduceAiConfigDraftState(module.createAiConfigDraftState(), {
      type: "field.changed",
      field: "apiKey",
      value: "sk-typed-before-load"
    });
    const hydrated = module.reduceAiConfigDraftState(withKey, {
      type: "draft.hydrated",
      config: {
        configured: false,
        baseUrl: "https://api.example.com/v1",
        model: "model",
        maskedApiKey: ""
      },
      draft: null
    });

    expect(hydrated.fields).toEqual({
      baseUrl: "https://api.example.com/v1",
      model: "model",
      apiKey: "sk-typed-before-load"
    });
  });
});
