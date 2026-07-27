import { createServer } from "node:net";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { PlanApiConnectionTester, reservePlanApiTestPort, type PlanApiConnectionTestTunnel } from "./planApiConnectionTester.js";
import type { PlanApiConnectionInput } from "../../shared/planApiBridgeContract.js";
import type { PlanApiHealth } from "./planApiWireTypes.js";

const input = (overrides: Partial<PlanApiConnectionInput> = {}): PlanApiConnectionInput => ({ mode: "local", baseUrl: "http://plan.local:8743", sshTarget: "", localPort: 8743, remotePort: 8743, desktopToken: "form-token", ...overrides });
const health = (overrides: Partial<PlanApiHealth> = {}): PlanApiHealth => ({ status: "ok", service: "plan-api", apiVersion: 1, database: { status: "ok" }, serverRevision: 42, ...overrides });
const never = <T>(): Promise<T> => new Promise(() => {});
function deps(overrides: Record<string, unknown> = {}) {
  return {
    resolveConnection: vi.fn(async (value: PlanApiConnectionInput) => ({ ...value, token: value.desktopToken })), reservePort: vi.fn(async () => 49152),
    createTunnel: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })), createClient: vi.fn(() => ({ health: vi.fn(async () => health()) })),
    now: Date.now, sleep: async () => {}, timeoutMs: 40, pollMs: 2, ...overrides,
  };
}

describe("PlanApiConnectionTester", () => {
  it("defines tunnel start as synchronous void", () => {
    expectTypeOf<ReturnType<PlanApiConnectionTestTunnel["start"]>>().toEqualTypeOf<void>();
  });

  it("tests a local form once without a tunnel or save", async () => {
    const save = vi.fn(); const d = deps(); Object.assign(d.resolveConnection, { save });
    await expect(new PlanApiConnectionTester(d).test(input())).resolves.toEqual({ ok: true, message: "Plan API 连接正常", apiVersion: 1, serverRevision: 42 });
    expect(d.createClient).toHaveBeenCalledWith("http://plan.local:8743", "form-token"); expect(d.createTunnel).not.toHaveBeenCalled(); expect(save).not.toHaveBeenCalled();
  });

  it("uses a synchronous SSH start with a temporary localhost URL and stops once", async () => {
    const tunnel: PlanApiConnectionTestTunnel = { start: vi.fn(), stop: vi.fn() }; const d = deps({ createTunnel: () => tunnel });
    await expect(new PlanApiConnectionTester(d).test(input({ mode: "ssh", sshTarget: "user@host", remotePort: 9876 }))).resolves.toMatchObject({ ok: true });
    expect(d.createClient).toHaveBeenCalledWith("http://127.0.0.1:49152", "form-token"); expect(tunnel.start).toHaveBeenCalledWith({ sshTarget: "user@host", localPort: 49152, remotePort: 9876 }); expect(tunnel.stop).toHaveBeenCalledOnce();
  });

  it("retries health until it succeeds within one deadline", async () => {
    let now = 0; const client = { health: vi.fn().mockRejectedValueOnce(new Error()).mockRejectedValueOnce(new Error()).mockResolvedValue(health()) };
    const d = deps({ createClient: () => client, now: () => now, timeoutMs: 100, pollMs: 25, sleep: async (ms: number) => { now += ms; } });
    await expect(new PlanApiConnectionTester(d).test(input({ mode: "ssh", sshTarget: "host" }))).resolves.toMatchObject({ ok: true }); expect(client.health).toHaveBeenCalledTimes(3);
  });

  it("bounds a never-settling health check and stops the SSH tunnel", async () => {
    const tunnel = { start: vi.fn(), stop: vi.fn() }; const d = deps({ createTunnel: () => tunnel, createClient: () => ({ health: () => never<PlanApiHealth>() }), timeoutMs: 15 });
    await expect(new PlanApiConnectionTester(d).test(input({ mode: "ssh", sshTarget: "host" }))).resolves.toEqual({ ok: false, message: "Plan API 连接测试超时，请检查服务或 SSH 隧道。" }); expect(tunnel.stop).toHaveBeenCalledOnce();
  });

  it("bounds a never-settling retry sleep", async () => {
    const d = deps({ createClient: () => ({ health: async () => { throw new Error(); } }), sleep: () => never<void>(), timeoutMs: 15 });
    await expect(new PlanApiConnectionTester(d).test(input({ mode: "ssh", sshTarget: "host" }))).resolves.toEqual({ ok: false, message: "Plan API 连接测试超时，请检查服务或 SSH 隧道。" });
  });

  it.each(["resolve", "start", "health", "sleep"])("returns a fixed safe category when %s fails", async (step) => {
    const tunnel = { start: vi.fn(), stop: vi.fn() }; const d = deps({ resolveConnection: async (value: PlanApiConnectionInput) => { if (step === "resolve") throw new Error("Authorization: Bearer saved-secret token=second-secret"); return { ...value, token: value.desktopToken }; }, createTunnel: () => tunnel, createClient: () => ({ health: async () => { throw new Error("token=secret"); } }), sleep: async () => { if (step === "sleep") throw new Error("Bearer hidden"); } });
    if (step === "start") tunnel.start.mockImplementation(() => { throw new Error("token=secret"); });
    if (step === "health") d.sleep = async () => { throw new Error(); };
    const result = await new PlanApiConnectionTester(d).test(input({ mode: "ssh", sshTarget: "host", desktopToken: "" }));
    expect(result).toMatchObject({ ok: false, message: expect.any(String) }); expect(result.message).not.toMatch(/saved-secret|second-secret|bearer|token=/i); if (step !== "resolve") expect(tunnel.stop).toHaveBeenCalledOnce();
  });

  it("uses primary failures over falsy cleanup failures and reports lone falsy cleanup", async () => {
    const primary = { start: vi.fn(() => { throw undefined; }), stop: vi.fn(() => Promise.reject(undefined)) };
    await expect(new PlanApiConnectionTester(deps({ createTunnel: () => primary })).test(input({ mode: "ssh", sshTarget: "host" }))).resolves.toEqual({ ok: false, message: "Plan API 配置或连接失败，请检查地址、令牌与 SSH 配置。" });
    const cleanup = { start: vi.fn(), stop: vi.fn(() => Promise.reject(null)) };
    await expect(new PlanApiConnectionTester(deps({ createTunnel: () => cleanup })).test(input({ mode: "ssh", sshTarget: "host" }))).resolves.toEqual({ ok: false, message: "SSH 隧道清理失败，请重试连接测试。" });
  });

  it("rejects malformed service and revision health values", async () => {
    for (const value of [health({ service: "other" as never }), health({ serverRevision: -1 }), health({ serverRevision: 1.5 })]) {
      await expect(new PlanApiConnectionTester(deps({ createClient: () => ({ health: async () => value }) })).test(input())).resolves.toEqual({ ok: false, message: "Plan API 响应无效，请检查服务版本。" });
    }
  });

  it("releases the default reserved socket", async () => {
    const port = await reservePlanApiTestPort(); const server = createServer();
    await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(port, "127.0.0.1", resolve); }); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  });

  it("keeps both task files within 220 lines", () => {
    for (const name of ["planApiConnectionTester.ts", "planApiConnectionTester.test.ts"]) expect(readFileSync(fileURLToPath(new URL(`./${name}`, import.meta.url)), "utf8").split(/\r?\n/).length).toBeLessThanOrEqual(220);
  });
});
