import { createServer } from "node:net";
import type { PlanApiConnectionInput, PlanApiConnectionTestResult } from "../../shared/planApiBridgeContract.js";
import type { PlanApiRuntimeConnection } from "./planApiConnectionStore.js";
import { PlanApiError } from "./planApiErrors.js";
import { parsePlanApiHealth, type PlanApiHealth } from "./planApiWireTypes.js";

export interface PlanApiConnectionTestTunnel {
  start(config: { sshTarget: string; localPort: number; remotePort: number }): void;
  stop(): void | Promise<void>;
}
export interface PlanApiConnectionTestClient { health(): Promise<PlanApiHealth>; }
export interface PlanApiConnectionTesterDependencies {
  resolveConnection(input: PlanApiConnectionInput): Promise<PlanApiRuntimeConnection | null>;
  reservePort(): Promise<number>; createTunnel(): PlanApiConnectionTestTunnel;
  createClient(baseUrl: string, token: string): PlanApiConnectionTestClient;
  now?(): number; sleep?(milliseconds: number): Promise<void>; timeoutMs?: number; pollMs?: number;
}

/** 不保存当前表单配置地验证 Plan API 可连接性。 */
export class PlanApiConnectionTester {
  private readonly now: () => number;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly timeoutMs: number;
  private readonly pollMs: number;
  constructor(private readonly dependencies: PlanApiConnectionTesterDependencies) {
    this.now = dependencies.now ?? Date.now;
    this.sleep = dependencies.sleep ?? (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)));
    this.timeoutMs = positive(dependencies.timeoutMs, 8_000); this.pollMs = positive(dependencies.pollMs, 250);
  }

  async test(input: PlanApiConnectionInput): Promise<PlanApiConnectionTestResult> {
    let tunnel: PlanApiConnectionTestTunnel | undefined;
    let result: PlanApiConnectionTestResult | undefined;
    let primary: unknown; let hasPrimary = false;
    try {
      const connection = await this.dependencies.resolveConnection(input);
      if (!connection) throw new Error();
      const deadline = this.now() + this.timeoutMs;
      if (connection.mode === "local") {
        result = success(await this.checkWithDeadline(this.dependencies.createClient(connection.baseUrl, connection.token), deadline));
      } else {
        const localPort = await this.withDeadline(this.dependencies.reservePort(), deadline);
        this.ensureBefore(deadline); tunnel = this.dependencies.createTunnel();
        tunnel.start({ sshTarget: connection.sshTarget, localPort, remotePort: connection.remotePort });
        this.ensureBefore(deadline);
        result = success(await this.poll(this.dependencies.createClient(`http://127.0.0.1:${localPort}`, connection.token), deadline));
      }
    } catch (error) { primary = error; hasPrimary = true; }
    finally {
      if (tunnel) try { await tunnel.stop(); } catch { if (!hasPrimary) { primary = new CleanupFailed(); hasPrimary = true; } }
    }
    return hasPrimary ? failed(primary) : result ?? failed(new Error());
  }

  private async poll(client: PlanApiConnectionTestClient, deadline: number): Promise<PlanApiHealth> {
    while (true) {
      try { return await this.checkWithDeadline(client, deadline); }
      catch (error) {
        if (error instanceof DeadlineExceeded || error instanceof InvalidHealth || error instanceof PlanApiError && (error.code === "auth_failed" || error.code === "response_invalid")) throw error;
        this.ensureBefore(deadline);
        await this.withDeadline(this.sleep(Math.min(this.pollMs, deadline - this.now())), deadline);
      }
    }
  }
  private async checkWithDeadline(client: PlanApiConnectionTestClient, deadline: number): Promise<PlanApiHealth> {
    const value = await this.withDeadline(client.health(), deadline);
    try { return parsePlanApiHealth(value); } catch { throw new InvalidHealth(); }
  }
  private ensureBefore(deadline: number): void { if (this.now() >= deadline) throw new DeadlineExceeded(); }
  private async withDeadline<T>(value: Promise<T>, deadline: number): Promise<T> {
    const remaining = deadline - this.now(); if (remaining <= 0) throw new DeadlineExceeded();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { return await Promise.race([value, new Promise<T>((_resolve, reject) => { timer = setTimeout(() => reject(new DeadlineExceeded()), remaining); })]); }
    finally { if (timer) clearTimeout(timer); }
  }
}

/** 分配后立即关闭仅用于 SSH 连接测试的回环端口。 */
export async function reservePlanApiTestPort(): Promise<number> {
  const server = createServer();
  try {
    const port = await new Promise<number>((resolve, reject) => {
      server.once("error", reject); server.listen(0, "127.0.0.1", () => {
        const address = server.address(); if (!address || typeof address === "string") reject(new Error()); else resolve(address.port);
      });
    });
    await close(server); return port;
  } catch (error) {
    if (server.listening) try { await close(server); } catch { /* 保留主错误，同时避免遗留监听端口。 */ }
    throw error;
  }
}

class DeadlineExceeded extends Error {}
class CleanupFailed extends Error {}
class InvalidHealth extends Error {}
function positive(value: number | undefined, fallback: number): number { return value !== undefined && Number.isFinite(value) && value > 0 ? value : fallback; }
function close(server: ReturnType<typeof createServer>): Promise<void> { return new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
function success(health: PlanApiHealth): PlanApiConnectionTestResult { return { ok: true, message: "Plan API 连接正常", apiVersion: 1, serverRevision: health.serverRevision }; }
function failed(error: unknown): PlanApiConnectionTestResult {
  if (error instanceof DeadlineExceeded) return { ok: false, message: "Plan API 连接测试超时，请检查服务或 SSH 隧道。" };
  if (error instanceof CleanupFailed) return { ok: false, message: "SSH 隧道清理失败，请重试连接测试。" };
  if (error instanceof InvalidHealth || error instanceof PlanApiError && error.code === "response_invalid") return { ok: false, message: "Plan API 响应无效，请检查服务版本。" };
  if (error instanceof PlanApiError && error.code === "auth_failed") return { ok: false, message: "Plan API 认证失败，请检查令牌。" };
  if (error instanceof PlanApiError && error.code === "offline") return { ok: false, message: "无法连接 Plan API，请检查地址、网络或 SSH 隧道。" };
  return { ok: false, message: "Plan API 配置或连接失败，请检查地址、令牌与 SSH 配置。" };
}
