/**
 * 模块用途：验证 AI 使用 Plan API 的 SSH 目标时，隧道能按配置切换并安全终止。
 * 模块边界：只使用内存替身验证传输协调，不启动真实 SSH、网络或模型请求。
 */
import { describe, expect, it, vi } from "vitest";
import type { PlanApiPublicConfig } from "../../shared/planApiBridgeContract.js";
import type { AiModelCredentials } from "./aiConfigTypes.js";
import { AiSshTransport, SshAwareModelClient } from "./aiSshTransport.js";

const credentials: AiModelCredentials = {
  baseUrl: "http://127.0.0.1:8642/v1",
  model: "hermes-agent",
  apiKey: "secret"
};

function sshConfig(
  overrides: Partial<PlanApiPublicConfig> = {}
): PlanApiPublicConfig {
  return {
    schemaVersion: 1,
    configured: true,
    mode: "ssh",
    baseUrl: "",
    sshTarget: "hermes-plan",
    localPort: 8743,
    remotePort: 8743,
    tokenConfigured: true,
    tokenHint: "abcd",
    ...overrides
  };
}

function createHarness(listening = false) {
  const tunnel = { start: vi.fn(), stop: vi.fn() };
  const resolvePlanApiConfig = vi.fn(async () => sshConfig());
  const isListening = vi.fn(async () => listening);
  const waitUntilListening = vi.fn(async () => true);
  const transport = new AiSshTransport({
    resolvePlanApiConfig,
    tunnel,
    network: { isListening, waitUntilListening }
  });
  return {
    transport,
    tunnel,
    resolvePlanApiConfig,
    isListening,
    waitUntilListening
  };
}

describe("AiSshTransport", () => {
  it("starts a separate Hermes tunnel through the saved Plan API SSH target", async () => {
    const harness = createHarness();

    await harness.transport.prepare(credentials);

    expect(harness.tunnel.start).toHaveBeenCalledWith({
      sshTarget: "hermes-plan",
      localPort: 8642,
      remotePort: 8642
    });
    expect(harness.waitUntilListening).toHaveBeenCalledWith(8642, 5_000);
  });

  it("does not start a tunnel when the local Hermes port already listens", async () => {
    const harness = createHarness(true);

    await harness.transport.prepare(credentials);

    expect(harness.resolvePlanApiConfig).not.toHaveBeenCalled();
    expect(harness.tunnel.start).not.toHaveBeenCalled();
  });

  it("restarts its managed tunnel when the saved SSH target changes", async () => {
    const harness = createHarness();
    harness.isListening
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    harness.resolvePlanApiConfig
      .mockResolvedValueOnce(sshConfig({ sshTarget: "server-a" }))
      .mockResolvedValueOnce(sshConfig({ sshTarget: "server-b" }));

    await harness.transport.prepare(credentials);
    await harness.transport.prepare(credentials);

    expect(harness.tunnel.start).toHaveBeenNthCalledWith(2, {
      sshTarget: "server-b",
      localPort: 8642,
      remotePort: 8642
    });
  });

  it("stops its managed tunnel when the saved connection is no longer SSH", async () => {
    const harness = createHarness();
    harness.resolvePlanApiConfig
      .mockResolvedValueOnce(sshConfig())
      .mockResolvedValueOnce(sshConfig({
        configured: true,
        mode: "local",
        sshTarget: ""
      }));

    await harness.transport.prepare(credentials);
    await expect(harness.transport.prepare(credentials)).rejects.toThrow(
      "请先配置云端 SSH 数据服务"
    );

    expect(harness.tunnel.stop).toHaveBeenCalledOnce();
  });

  it("cancels a pending tunnel start when stopped during config resolution", async () => {
    const harness = createHarness();
    let resolveConfig: (config: PlanApiPublicConfig) => void = () => undefined;
    harness.resolvePlanApiConfig.mockImplementation(
      () => new Promise((resolve) => { resolveConfig = resolve; })
    );

    const preparing = harness.transport.prepare(credentials);
    await vi.waitFor(() => expect(harness.resolvePlanApiConfig).toHaveBeenCalledOnce());
    harness.transport.stop();
    resolveConfig(sshConfig());
    await expect(preparing).rejects.toThrow("AI SSH 传输已关闭");

    expect(harness.tunnel.start).not.toHaveBeenCalled();
    expect(harness.tunnel.stop).toHaveBeenCalledOnce();
  });

  it("leaves non-Hermes model endpoints untouched", async () => {
    const harness = createHarness();

    await harness.transport.prepare({
      ...credentials,
      baseUrl: "https://api.example.com/v1",
      model: "gpt-example"
    });

    expect(harness.isListening).not.toHaveBeenCalled();
    expect(harness.resolvePlanApiConfig).not.toHaveBeenCalled();
  });

  it("rejects loopback Hermes requests when no SSH connection is configured", async () => {
    const harness = createHarness();
    harness.resolvePlanApiConfig.mockResolvedValue(
      sshConfig({ configured: false, mode: "local", sshTarget: "" })
    );

    await expect(harness.transport.prepare(credentials)).rejects.toThrow(
      "请先配置云端 SSH 数据服务"
    );
    expect(harness.tunnel.start).not.toHaveBeenCalled();
  });

  it("prepares the tunnel before delegating a model request", async () => {
    const harness = createHarness();
    const delegate = {
      requestAssistant: vi.fn(async () => "ok"),
      testConnection: vi.fn(async () => undefined)
    };
    const client = new SshAwareModelClient(delegate, harness.transport);

    await expect(client.requestAssistant(
      credentials,
      [{ role: "user", content: "hello" }],
      { sessionId: "session", requestId: "request" }
    )).resolves.toBe("ok");

    expect(harness.waitUntilListening).toHaveBeenCalledBefore(
      delegate.requestAssistant
    );
  });
});
