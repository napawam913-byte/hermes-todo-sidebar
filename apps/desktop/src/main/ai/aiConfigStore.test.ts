/**
 * 模块用途：验证模型配置中的 API Key 只以加密密文持久化并对 renderer 脱敏。
 * 模块边界：使用内存端口，不调用 Electron safeStorage 或真实文件系统。
 */
import { describe, expect, it } from "vitest";
import { AiConfigStore, type AiConfigPersistence, type SecretProtector } from "./aiConfigStore.js";
import type { StoredAiConfigV1 } from "./aiConfigTypes.js";

function createPorts(initial: StoredAiConfigV1 | null = null) {
  let stored = initial;
  const persistence: AiConfigPersistence = {
    load: async () => structuredClone(stored),
    save: async (value) => { stored = structuredClone(value); }
  };
  const protector: SecretProtector = {
    isAvailable: () => true,
    encrypt: (value) => Buffer.from(`encrypted:${value}`, "utf8"),
    decrypt: (value) => value.toString("utf8").replace("encrypted:", "")
  };
  return { persistence, protector, readStored: () => stored };
}

describe("AiConfigStore", () => {
  it("encrypts the API key and only returns a masked public snapshot", async () => {
    const ports = createPorts();
    const store = new AiConfigStore(ports.persistence, ports.protector, () => new Date("2026-07-14T09:00:00Z"));

    const publicConfig = await store.save({
      baseUrl: "https://api.example.com/v1/",
      model: "qwen-plus",
      apiKey: "sk-super-secret"
    });

    const raw = JSON.stringify(ports.readStored());
    expect(raw).not.toContain("sk-super-secret");
    expect(publicConfig).toEqual({
      configured: true,
      baseUrl: "https://api.example.com/v1",
      model: "qwen-plus",
      maskedApiKey: "sk-••••••cret"
    });
    await expect(store.getCredentials()).resolves.toMatchObject({ apiKey: "sk-super-secret" });
  });

  it("reports an unconfigured state without exposing storage details", async () => {
    const ports = createPorts();
    const store = new AiConfigStore(ports.persistence, ports.protector);
    await expect(store.getPublicConfig()).resolves.toEqual({
      configured: false,
      baseUrl: "",
      model: "",
      maskedApiKey: ""
    });
  });

  it("keeps the encrypted API key when an existing config is edited with a blank key", async () => {
    const ports = createPorts();
    const store = new AiConfigStore(ports.persistence, ports.protector);
    await store.save({
      baseUrl: "https://api.example.com/v1",
      model: "model-v1",
      apiKey: "sk-existing-key"
    });

    const publicConfig = await store.save({
      baseUrl: "https://api.example.com/v1",
      model: "model-v2",
      apiKey: ""
    });

    await expect(store.getCredentials()).resolves.toMatchObject({
      model: "model-v2",
      apiKey: "sk-existing-key"
    });
    expect(publicConfig.maskedApiKey).toBe("sk-••••••-key");
  });

  it("resolves current form credentials without persisting them", async () => {
    const ports = createPorts();
    const store = new AiConfigStore(ports.persistence, ports.protector);
    const resolver = (store as AiConfigStore & {
      resolveCredentials?: (input: {
        baseUrl: string;
        model: string;
        apiKey: string;
      }) => Promise<{ baseUrl: string; model: string; apiKey: string }>;
    }).resolveCredentials;

    expect(resolver).toBeTypeOf("function");
    if (!resolver) return;
    await expect(resolver.call(store, {
      baseUrl: "https://api.example.com/v1/",
      model: "model-current",
      apiKey: "sk-current"
    })).resolves.toEqual({
      baseUrl: "https://api.example.com/v1",
      model: "model-current",
      apiKey: "sk-current"
    });
    expect(ports.readStored()).toBeNull();
  });

  it("refuses to save secrets when safe encryption is unavailable", async () => {
    const ports = createPorts();
    const store = new AiConfigStore(ports.persistence, {
      ...ports.protector,
      isAvailable: () => false
    });

    await expect(store.save({ baseUrl: "https://api.example.com/v1", model: "model", apiKey: "sk-key" }))
      .rejects.toThrow(/安全存储/);
    expect(ports.readStored()).toBeNull();
  });
});
