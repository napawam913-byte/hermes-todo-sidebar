/**
 * 模块用途：验证连接探测能区分通用兼容端点、Hermes 在线和周期计划扩展状态。
 * 模块边界：使用注入 fetch，不访问真实 SSH 隧道或云服务器。
 */
import { describe, expect, it, vi } from "vitest";
import { HermesCapabilityProbe } from "./hermesCapabilityProbe.js";

const credentials = {
  baseUrl: "http://127.0.0.1:8642/v1",
  model: "hermes-agent",
  apiKey: "server-key"
};

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status });
}

describe("HermesCapabilityProbe", () => {
  it("reports Hermes with the cycle plan extension ready", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ status: "ok" }))
      .mockResolvedValueOnce(json({
        platform: "hermes-agent",
        endpoints: {
          skills: { path: "/v1/skills" },
          toolsets: { path: "/v1/toolsets" }
        }
      }))
      .mockResolvedValueOnce(json([{ name: "cycle-plan" }]))
      .mockResolvedValueOnce(json([{
        name: "cycle_plan",
        tools: ["cycle_plan_propose_create", "cycle_plan_propose_adjust"]
      }]));
    const probe = new HermesCapabilityProbe(fetchMock as typeof fetch);

    await expect(probe.inspect(credentials)).resolves.toEqual({
      provider: "hermes",
      cyclePlanExtension: "ready"
    });
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer server-key");
    expect(fetchMock.mock.calls[0][0]).toBe("http://127.0.0.1:8642/health");
  });

  it("reports an online Hermes server with a missing extension", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ status: "ok" }))
      .mockResolvedValueOnce(json({
        platform: "hermes-agent",
        endpoints: {
          skills: { path: "/v1/skills" },
          toolsets: { path: "/v1/toolsets" }
        }
      }))
      .mockResolvedValueOnce(json([]))
      .mockResolvedValueOnce(json([{ name: "cycle_plan", tools: [] }]));
    const probe = new HermesCapabilityProbe(fetchMock as typeof fetch);

    await expect(probe.inspect(credentials)).resolves.toEqual({
      provider: "hermes",
      cyclePlanExtension: "missing"
    });
  });

  it("keeps extension status unknown on Hermes v0.12 without discovery routes", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ status: "ok", platform: "hermes-agent" }))
      .mockResolvedValueOnce(json({
        platform: "hermes-agent",
        endpoints: { chat_completions: { path: "/v1/chat/completions" } }
      }));
    const probe = new HermesCapabilityProbe(fetchMock as typeof fetch);

    await expect(probe.inspect(credentials)).resolves.toEqual({
      provider: "hermes",
      cyclePlanExtension: "unknown"
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("falls back to a generic compatible endpoint when discovery is absent", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ error: "not found" }, 404));
    const probe = new HermesCapabilityProbe(fetchMock as typeof fetch);

    await expect(probe.inspect(credentials)).resolves.toEqual({
      provider: "openai-compatible",
      cyclePlanExtension: "unknown"
    });
  });
});
