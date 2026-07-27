import { createServer } from "node:net";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { PlanApiConnectionTester, reservePlanApiTestPort, type PlanApiConnectionTestTunnel } from "./planApiConnectionTester.js";
import { PlanApiError } from "./planApiErrors.js";
import type { PlanApiConnectionInput } from "../../shared/planApiBridgeContract.js";
import type { PlanApiHealth } from "./planApiWireTypes.js";

const input = (overrides: Partial<PlanApiConnectionInput> = {}): PlanApiConnectionInput => ({ mode: "local", baseUrl: "http://plan.local:8743", sshTarget: "", localPort: 8743, remotePort: 8743, desktopToken: "form-token", ...overrides });
const health = (overrides: Partial<PlanApiHealth> = {}): PlanApiHealth => ({ status: "ok", service: "plan-api", apiVersion: 1, database: { status: "ok" }, serverRevision: 42, ...overrides });
const never = <T>(): Promise<T> => new Promise(() => {});
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (reason?: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function deps(overrides: Record<string, unknown> = {}) {
  return { resolveConnection: vi.fn(async (value: PlanApiConnectionInput) => ({ ...value, token: value.desktopToken })), reservePort: vi.fn(async () => 49152), createTunnel: vi.fn(() => ({ start: vi.fn(() => undefined), stop: vi.fn() })), createClient: vi.fn(() => ({ health: vi.fn(async () => health()) })), now: Date.now, sleep: async () => {}, timeoutMs: 40, pollMs: 2, ...overrides };
}

// @ts-expect-error async starts are intentionally not a legal tunnel dependency.
const asyncTunnel: PlanApiConnectionTestTunnel = { start: async () => {}, stop: () => undefined };
void asyncTunnel;

describe("PlanApiConnectionTester", () => {
  it("tests a local form once without a tunnel or save", async () => {
    const save = vi.fn(); const d = deps(); Object.assign(d.resolveConnection, { save });
    await expect(new PlanApiConnectionTester(d).test(input())).resolves.toEqual({ ok: true, message: "Plan API 连接正常", apiVersion: 1, serverRevision: 42 });
    expect(d.createClient).toHaveBeenCalledWith("http://plan.local:8743", "form-token"); expect(d.createTunnel).not.toHaveBeenCalled(); expect(save).not.toHaveBeenCalled();
  });

  it("uses an undefined-returning SSH start with a temporary URL and one normal stop", async () => {
    const tunnel: PlanApiConnectionTestTunnel = { start: vi.fn(() => undefined), stop: vi.fn(() => undefined) }; const d = deps({ createTunnel: () => tunnel });
    await expect(new PlanApiConnectionTester(d).test(input({ mode: "ssh", sshTarget: "user@host", remotePort: 9876 }))).resolves.toMatchObject({ ok: true });
    expect(d.createClient).toHaveBeenCalledWith("http://127.0.0.1:49152", "form-token"); expect(tunnel.start).toHaveBeenCalledWith({ sshTarget: "user@host", localPort: 49152, remotePort: 9876 }); expect(tunnel.stop).toHaveBeenCalledOnce();
  });

  it("fails safely and cleans again when a bypassed late start settles", async () => {
    const late = deferred<void>(); const tunnel = { start: vi.fn(() => late.promise as unknown as undefined), stop: vi.fn(() => undefined) }; const unhandled = vi.fn(); process.on("unhandledRejection", unhandled);
    try {
      await expect(new PlanApiConnectionTester(deps({ createTunnel: () => tunnel })).test(input({ mode: "ssh", sshTarget: "host" }))).resolves.toMatchObject({ ok: false }); expect(tunnel.stop).toHaveBeenCalledOnce();
      late.reject(new Error("late")); await new Promise(resolve => setTimeout(resolve, 0)); expect(unhandled).not.toHaveBeenCalled(); expect(tunnel.stop).toHaveBeenCalledTimes(2);
    } finally { process.off("unhandledRejection", unhandled); }
  });

  it("does not start health when the deadline is already elapsed", async () => {
    let now = 0; const client = { health: vi.fn(async () => health()) };
    const d = deps({ now: () => now, timeoutMs: 5, createClient: () => { now = 5; return client; } });
    await expect(new PlanApiConnectionTester(d).test(input())).resolves.toMatchObject({ ok: false }); expect(client.health).not.toHaveBeenCalled();
  });

  it("handles a late health rejection after the deadline without an unhandled rejection", async () => {
    const late = deferred<PlanApiHealth>(); const unhandled = vi.fn(); process.on("unhandledRejection", unhandled);
    try {
      await expect(new PlanApiConnectionTester(deps({ createClient: () => ({ health: () => late.promise }), timeoutMs: 10 })).test(input())).resolves.toMatchObject({ ok: false }); late.reject(new Error("late")); await new Promise(resolve => setTimeout(resolve, 0)); expect(unhandled).not.toHaveBeenCalled();
    } finally { process.off("unhandledRejection", unhandled); }
  });

  it("retries offline health but not a 404 response", async () => {
    let now = 0; const offline = { health: vi.fn().mockRejectedValueOnce(new PlanApiError("offline")).mockResolvedValue(health()) };
    const retried = deps({ createClient: () => offline, now: () => now, timeoutMs: 100, sleep: async (ms: number) => { now += ms; } });
    await expect(new PlanApiConnectionTester(retried).test(input({ mode: "ssh", sshTarget: "host" }))).resolves.toMatchObject({ ok: true }); expect(offline.health).toHaveBeenCalledTimes(2);
    const notRetried = { health: vi.fn().mockRejectedValue(new PlanApiError("http_error", 404)) };
    await expect(new PlanApiConnectionTester(deps({ createClient: () => notRetried })).test(input({ mode: "ssh", sshTarget: "host" }))).resolves.toMatchObject({ ok: false }); expect(notRetried.health).toHaveBeenCalledOnce();
  });

  it("bounds never-settling health and retry sleep", async () => {
    const healthTimeout = deps({ createClient: () => ({ health: () => never<PlanApiHealth>() }), timeoutMs: 15 });
    await expect(new PlanApiConnectionTester(healthTimeout).test(input({ mode: "ssh", sshTarget: "host" }))).resolves.toMatchObject({ ok: false });
    const sleepTimeout = deps({ createClient: () => ({ health: async () => { throw new PlanApiError("offline"); } }), sleep: () => never<void>(), timeoutMs: 15 });
    await expect(new PlanApiConnectionTester(sleepTimeout).test(input({ mode: "ssh", sshTarget: "host" }))).resolves.toMatchObject({ ok: false });
  });

  it("returns fixed safe categories for failure, cleanup, and malformed health", async () => {
    const secret = "Authorization: Bearer saved-secret token=second-secret";
    const resolve = deps({ resolveConnection: async () => { throw new Error(secret); } });
    const result = await new PlanApiConnectionTester(resolve).test(input({ desktopToken: "" })); expect(result.message).not.toMatch(/saved-secret|second-secret|bearer|token=/i);
    const cleanup = { start: vi.fn(() => undefined), stop: vi.fn(() => Promise.reject(null)) };
    await expect(new PlanApiConnectionTester(deps({ createTunnel: () => cleanup })).test(input({ mode: "ssh", sshTarget: "host" }))).resolves.toMatchObject({ ok: false });
    await expect(new PlanApiConnectionTester(deps({ createClient: () => ({ health: async () => health({ serverRevision: -1 }) }) })).test(input())).resolves.toMatchObject({ ok: false });
  });

  it("releases the default reserved socket", async () => {
    const port = await reservePlanApiTestPort(); const server = createServer();
    await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(port, "127.0.0.1", resolve); }); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  });

  it("keeps both task files within 220 lines", () => {
    for (const name of ["planApiConnectionTester.ts", "planApiConnectionTester.test.ts"]) expect(readFileSync(fileURLToPath(new URL(`./${name}`, import.meta.url)), "utf8").split(/\r?\n/).length).toBeLessThanOrEqual(220);
  });
});
