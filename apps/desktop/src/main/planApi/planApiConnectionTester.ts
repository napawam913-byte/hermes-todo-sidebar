import { createServer } from "node:net";
import type { PlanApiConnectionInput, PlanApiConnectionTestResult } from "../../shared/planApiBridgeContract.js";
import type { PlanApiRuntimeConnection } from "./planApiConnectionStore.js";
import type { PlanApiHealth } from "./planApiWireTypes.js";

export interface PlanApiConnectionTestTunnel {
  start(config: { sshTarget: string; localPort: number; remotePort: number }): void | Promise<void>;
  stop(): void | Promise<void>;
}
export interface PlanApiConnectionTestClient { health(): Promise<PlanApiHealth>; }
export interface PlanApiConnectionTesterDependencies {
  resolveConnection(input: PlanApiConnectionInput): Promise<PlanApiRuntimeConnection | null>;
  reservePort(): Promise<number>;
  createTunnel(): PlanApiConnectionTestTunnel;
  createClient(baseUrl: string, token: string): PlanApiConnectionTestClient;
  now?(): number;
  sleep?(milliseconds: number): Promise<void>;
}

const timeoutMs = 8_000;
const pollMs = 250;

/** 不保存当前表单配置地验证 Plan API 可连接性。 */
export class PlanApiConnectionTester {
  private readonly now: () => number;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  constructor(private readonly dependencies: PlanApiConnectionTesterDependencies) {
    this.now = dependencies.now ?? Date.now;
    this.sleep = dependencies.sleep ?? ((milliseconds) => new Promise(resolve => setTimeout(resolve, milliseconds)));
  }

  async test(input: PlanApiConnectionInput): Promise<PlanApiConnectionTestResult> {
    let tunnel: PlanApiConnectionTestTunnel | undefined;
    let result: PlanApiConnectionTestResult | undefined;
    let failure: unknown;
    let token = input.desktopToken;
    try {
      const connection = await this.dependencies.resolveConnection(input);
      if (!connection) throw new Error("无法解析当前 Plan API 配置");
      token = connection.token;
      if (connection.mode === "local") {
        result = success(await this.check(this.dependencies.createClient(connection.baseUrl, connection.token)));
      } else {
        const deadline = this.now() + timeoutMs;
        const localPort = await this.withDeadline(this.dependencies.reservePort(), deadline);
        tunnel = this.dependencies.createTunnel();
        await this.withDeadline(tunnel.start({ sshTarget: connection.sshTarget, localPort, remotePort: connection.remotePort }), deadline);
        const client = this.dependencies.createClient(`http://127.0.0.1:${localPort}`, connection.token);
        result = success(await this.poll(client, deadline));
      }
    } catch (error) { failure = error; }
    finally {
      if (tunnel) try { await tunnel.stop(); } catch (error) { if (!failure && result) failure = error; }
    }
    return failure ? failed(failure, token) : result ?? failed(new Error("连接测试未完成"), token);
  }

  private async poll(client: PlanApiConnectionTestClient, deadline: number): Promise<PlanApiHealth> {
    let lastError: unknown;
    while (this.now() < deadline) {
      try { return await this.checkWithDeadline(client, deadline); }
      catch (error) {
        if (error instanceof DeadlineExceeded) throw error;
        lastError = error;
        const remaining = deadline - this.now();
        if (remaining <= 0) break;
        await this.sleep(Math.min(pollMs, remaining));
      }
    }
    throw new DeadlineExceeded(lastError);
  }

  private async checkWithDeadline(client: PlanApiConnectionTestClient, deadline: number): Promise<PlanApiHealth> {
    return this.validateHealth(await this.withDeadline(client.health(), deadline));
  }
  private async check(client: PlanApiConnectionTestClient): Promise<PlanApiHealth> {
    return this.validateHealth(await client.health());
  }
  private validateHealth(health: PlanApiHealth): PlanApiHealth {
    if (health.apiVersion !== 1 || health.status !== "ok" || health.database?.status !== "ok" || !Number.isFinite(health.serverRevision)) {
      throw new Error("Plan API 健康检查返回无效状态");
    }
    return health;
  }
  private async withDeadline<T>(value: Promise<T> | T, deadline: number): Promise<T> {
    const remaining = deadline - this.now();
    if (remaining <= 0) throw new DeadlineExceeded();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([Promise.resolve(value), new Promise<T>((_resolve, reject) => { timer = setTimeout(() => reject(new DeadlineExceeded()), remaining); })]);
    } finally { if (timer) clearTimeout(timer); }
  }
}

/** 分配后立即关闭仅用于 SSH 连接测试的回环端口。 */
export async function reservePlanApiTestPort(): Promise<number> {
  const server = createServer();
  try {
    const port = await new Promise<number>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => {
        const address = server.address();
        if (!address || typeof address === "string") reject(new Error("无法获取临时端口")); else resolve(address.port);
      });
    });
    await close(server);
    return port;
  } catch (error) {
    if (server.listening) try { await close(server); } catch { /* 保留主错误，同时避免遗留监听端口。 */ }
    throw error;
  }
}

class DeadlineExceeded extends Error {
  constructor(cause?: unknown) {
    super(`SSH 隧道或健康检查在 8 秒内未完成${cause instanceof Error && cause.message ? `：${cause.message}` : ""}`);
  }
}
function close(server: ReturnType<typeof createServer>): Promise<void> {
  return new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}
function success(health: PlanApiHealth): PlanApiConnectionTestResult {
  return { ok: true, message: "Plan API 连接正常", apiVersion: 1, serverRevision: health.serverRevision };
}
function failed(error: unknown, token: string): PlanApiConnectionTestResult {
  const raw = error instanceof Error ? error.message : "未知错误";
  const withoutAuthorization = raw.replace(/authorization\s*[:=]?\s*[^\s,;]*/gi, "").trim();
  const message = token ? withoutAuthorization.split(token).join("[已隐藏]") : withoutAuthorization;
  return { ok: false, message: `Plan API 连接失败：${message || "请检查地址、令牌与 SSH 配置"}` };
}
