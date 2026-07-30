/**
 * 模块用途：在桌面端访问本机 Hermes 回环地址前，按需建立独立 SSH 隧道。
 * 模块边界：只复用数据服务的 SSH 目标，不读取令牌，也不处理模型业务响应。
 */
import { Socket } from "node:net";
import type { PlanApiPublicConfig } from "../../shared/planApiBridgeContract.js";
import type { AiModelCredentials } from "./aiConfigTypes.js";
import type {
  AiRequestMetadata,
  ModelMessage
} from "./openAiCompatibleClient.js";
import {
  PlanApiSshTunnel,
  type SshTunnelConfig
} from "../planApi/planApiSshTunnel.js";

const HERMES_API_PORT = 8642;
const START_TIMEOUT_MS = 5_000;

interface SshTunnelPort {
  start(config: SshTunnelConfig): void;
  stop(): void;
}

interface NetworkPort {
  isListening(port: number): Promise<boolean>;
  waitUntilListening(port: number, timeoutMs: number): Promise<boolean>;
}

interface ModelClientPort {
  requestAssistant(
    credentials: AiModelCredentials,
    messages: ModelMessage[],
    metadata: AiRequestMetadata
  ): Promise<string>;
  testConnection(credentials: AiModelCredentials): Promise<void>;
}

export interface AiSshTransportOptions {
  resolvePlanApiConfig(): Promise<PlanApiPublicConfig>;
  tunnel?: SshTunnelPort;
  network?: NetworkPort;
}

export class AiSshTransport {
  private readonly tunnel: SshTunnelPort;
  private readonly network: NetworkPort;
  private activeKey = "";
  private disposed = false;
  private generation = 0;
  private pending: Promise<void> | null = null;

  constructor(private readonly options: AiSshTransportOptions) {
    this.tunnel = options.tunnel ?? new PlanApiSshTunnel();
    this.network = options.network ?? nodeNetworkPort;
  }

  async prepare(credentials: AiModelCredentials): Promise<void> {
    if (this.disposed) throw new Error("AI SSH 传输已关闭");
    const port = readHermesLoopbackPort(credentials.baseUrl);
    if (port === null) return;
    if (!this.activeKey && await this.network.isListening(port)) return;
    if (this.pending) return this.pending;
    const pending = this.open(port, this.generation);
    this.pending = pending;
    try {
      await pending;
    } finally {
      if (this.pending === pending) this.pending = null;
    }
  }

  stop(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.generation += 1;
    this.activeKey = "";
    this.tunnel.stop();
  }

  private async open(port: number, generation: number): Promise<void> {
    const config = await this.options.resolvePlanApiConfig();
    this.assertActive(generation);
    if (!config.configured || config.mode !== "ssh" || !config.sshTarget) {
      if (this.activeKey) {
        this.activeKey = "";
        this.tunnel.stop();
      }
      throw new Error("请先配置云端 SSH 数据服务，再连接本机 Hermes 模型地址");
    }
    const key = `${config.sshTarget}:${port}`;
    if (this.activeKey !== key) {
      this.tunnel.start({
        sshTarget: config.sshTarget,
        localPort: port,
        remotePort: port
      });
      this.activeKey = key;
    }
    if (await this.network.waitUntilListening(port, START_TIMEOUT_MS)) {
      this.assertActive(generation);
      return;
    }
    this.assertActive(generation);
    this.activeKey = "";
    this.tunnel.stop();
    throw new Error("Hermes SSH 隧道启动超时，请检查 SSH 目标与云端 8642 服务");
  }

  private assertActive(generation: number): void {
    if (this.disposed || generation !== this.generation) {
      throw new Error("AI SSH 传输已关闭");
    }
  }
}

export class SshAwareModelClient implements ModelClientPort {
  constructor(
    private readonly delegate: ModelClientPort,
    private readonly transport: AiSshTransport
  ) {}

  async requestAssistant(
    credentials: AiModelCredentials,
    messages: ModelMessage[],
    metadata: AiRequestMetadata
  ): Promise<string> {
    await this.transport.prepare(credentials);
    return this.delegate.requestAssistant(credentials, messages, metadata);
  }

  async testConnection(credentials: AiModelCredentials): Promise<void> {
    await this.transport.prepare(credentials);
    return this.delegate.testConnection(credentials);
  }
}

function readHermesLoopbackPort(baseUrl: string): number | null {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    return null;
  }
  const loopback = url.hostname === "127.0.0.1"
    || url.hostname === "localhost"
    || url.hostname === "[::1]";
  const port = Number(url.port);
  return loopback && port === HERMES_API_PORT ? port : null;
}

const nodeNetworkPort: NetworkPort = {
  isListening: (port) => canConnect(port),
  async waitUntilListening(port, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await canConnect(port)) return true;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return false;
  }
};

function canConnect(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new Socket();
    const finish = (result: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(250);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    socket.connect(port, "127.0.0.1");
  });
}
