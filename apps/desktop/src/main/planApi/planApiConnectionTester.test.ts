import { createServer } from "node:net";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { PlanApiConnectionTester, reservePlanApiTestPort } from "./planApiConnectionTester.js";
import type { PlanApiConnectionInput } from "../../shared/planApiBridgeContract.js";
import type { PlanApiHealth } from "./planApiWireTypes.js";

const input = (overrides: Partial<PlanApiConnectionInput> = {}): PlanApiConnectionInput => ({ mode: "local", baseUrl: "http://plan.local:8743", sshTarget: "", localPort: 8743, remotePort: 8743, desktopToken: "form-token", ...overrides });
const health = (): PlanApiHealth => ({ status: "ok", service: "plan-api", apiVersion: 1, database: { status: "ok" }, serverRevision: 42 });
const failure = (message: string) => new Error(message);

function deps(overrides: Record<string, unknown> = {}) {
  return {
    resolveConnection: vi.fn(async (value: PlanApiConnectionInput) => ({ ...value, token: value.desktopToken })),
    reservePort: vi.fn(async () => 49152),
    createTunnel: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
    createClient: vi.fn(() => ({ health: vi.fn(async () => health()) })),
    now: vi.fn(() => 0),
    sleep: vi.fn(async () => {}),
    ...overrides,
  };
}

describe("PlanApiConnectionTester", () => {
  it("tests a local resolved form once without creating a tunnel", async () => {
    const save = vi.fn(); const d = deps(); Object.assign(d.resolveConnection, { save }); const tester = new PlanApiConnectionTester(d);
    await expect(tester.test(input())).resolves.toEqual({ ok: true, message: "Plan API 连接正常", apiVersion: 1, serverRevision: 42 });
    expect(d.createClient).toHaveBeenCalledWith("http://plan.local:8743", "form-token");
    expect(d.createTunnel).not.toHaveBeenCalled(); expect(d.reservePort).not.toHaveBeenCalled(); expect(save).not.toHaveBeenCalled();
  });

  it("tests ssh through a temporary local port and stops once", async () => {
    const tunnel = { start: vi.fn(), stop: vi.fn() };
    const d = deps({ createTunnel: vi.fn(() => tunnel) }); const tester = new PlanApiConnectionTester(d);
    await expect(tester.test(input({ mode: "ssh", sshTarget: "user@host", remotePort: 9876 }))).resolves.toMatchObject({ ok: true });
    expect(d.createClient).toHaveBeenCalledWith("http://127.0.0.1:49152", "form-token");
    expect(tunnel.start).toHaveBeenCalledWith({ sshTarget: "user@host", localPort: 49152, remotePort: 9876 });
    expect(tunnel.stop).toHaveBeenCalledOnce();
  });

  it("retries SSH health checks until one succeeds", async () => {
    let time = 0; const client = { health: vi.fn().mockRejectedValueOnce(failure("not ready")).mockRejectedValueOnce(failure("still starting")).mockResolvedValue(health()) };
    const sleep = vi.fn(async (ms: number) => { time += ms; });
    const d = deps({ createClient: vi.fn(() => client), now: () => time, sleep });
    await expect(new PlanApiConnectionTester(d).test(input({ mode: "ssh", sshTarget: "host" }))).resolves.toMatchObject({ ok: true });
    expect(client.health).toHaveBeenCalledTimes(3); expect(sleep).toHaveBeenCalledWith(250);
  });

  it("times out SSH health polling within the eight second budget", async () => {
    let time = 0; const d = deps({ createClient: vi.fn(() => ({ health: vi.fn(async () => { throw failure("offline"); }) })), now: () => time, sleep: async (ms: number) => { time += ms; } });
    await expect(new PlanApiConnectionTester(d).test(input({ mode: "ssh", sshTarget: "host" }))).resolves.toMatchObject({ ok: false, message: expect.stringMatching(/8 秒|超时/) });
    expect(d.createTunnel.mock.results[0].value.stop).toHaveBeenCalledOnce();
  });

  it.each(["resolve", "start", "health", "sleep"])("returns a safe Chinese failure when %s fails", async (step) => {
    const secret = "token-not-for-errors"; const tunnel = { start: vi.fn(), stop: vi.fn() };
    let time = 0; const d = deps({ resolveConnection: async (value: PlanApiConnectionInput) => { if (step === "resolve") throw failure(secret); return { ...value, token: secret }; }, createTunnel: vi.fn(() => tunnel), createClient: () => ({ health: async () => { if (step === "health" || step === "sleep") throw failure(secret); return health(); } }), sleep: async (ms: number) => { if (step === "sleep") throw failure(secret); time += ms; }, now: () => time });
    if (step === "start") tunnel.start.mockImplementation(() => { throw failure(secret); });
    const result = await new PlanApiConnectionTester(d).test(input({ mode: "ssh", sshTarget: "host", desktopToken: secret }));
    expect(result).toMatchObject({ ok: false, message: expect.any(String) }); expect(result.message).not.toContain(secret); expect(result.message).not.toMatch(/authorization/i);
    if (step !== "resolve") expect(tunnel.stop).toHaveBeenCalledOnce();
  });

  it("keeps the primary failure when stop also fails, but reports lone stop failures", async () => {
    const primary = { start: vi.fn(), stop: vi.fn(() => { throw failure("cleanup"); }) };
    let time = 0; const failed = deps({ createTunnel: () => primary, createClient: () => ({ health: async () => { throw failure("primary"); } }), now: () => time, sleep: async (ms: number) => { time += ms; } });
    await expect(new PlanApiConnectionTester(failed).test(input({ mode: "ssh", sshTarget: "host" }))).resolves.toMatchObject({ ok: false, message: expect.stringContaining("primary") });
    const cleanup = { start: vi.fn(), stop: vi.fn(() => { throw failure("cleanup"); }) };
    const clean = deps({ createTunnel: () => cleanup });
    await expect(new PlanApiConnectionTester(clean).test(input({ mode: "ssh", sshTarget: "host" }))).resolves.toMatchObject({ ok: false, message: expect.stringContaining("cleanup") });
  });

  it("releases the default reserved socket", async () => {
    const port = await reservePlanApiTestPort(); const server = createServer();
    await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(port, "127.0.0.1", () => resolve()); });
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  });

  it("keeps both task files within 220 lines", () => {
    for (const name of ["planApiConnectionTester.ts", "planApiConnectionTester.test.ts"]) expect(readFileSync(fileURLToPath(new URL(`./${name}`, import.meta.url)), "utf8").split(/\r?\n/).length).toBeLessThanOrEqual(220);
  });
});
