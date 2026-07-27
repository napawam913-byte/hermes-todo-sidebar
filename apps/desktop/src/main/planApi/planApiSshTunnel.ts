import { spawn as nodeSpawn, type SpawnOptions } from "node:child_process";

/** 管理本进程启动的 Windows OpenSSH 本地转发隧道。 */
export type SshTunnelState =
  | { type: "stopped" }
  | { type: "starting" }
  | { type: "running"; pid?: number }
  | { type: "reconnecting"; attempt: number; message: string }
  | { type: "failed"; message: string };

export interface SshTunnelConfig { sshTarget: string; localPort: number; remotePort: number; }
export interface SshTunnelChild {
  pid?: number;
  kill(): boolean;
  once(event: "spawn", listener: () => void): unknown;
  once(event: "error", listener: (error: Error) => void): unknown;
  once(event: "exit", listener: (code: number | null, signal: NodeJS.Signals | null) => void): unknown;
}
export interface SshTunnelPorts {
  spawn(command: string, args: string[], options: SpawnOptions): SshTunnelChild;
  schedule(callback: () => void, delayMs: number): unknown;
  cancel(timer: unknown): void;
}

const RETRY_DELAYS = [1000, 2000, 5000, 10000, 30000] as const;
const targetPattern = /^[A-Za-z0-9._@:-]+$/;
const nodePorts: SshTunnelPorts = {
  spawn: (command, args, options) => nodeSpawn(command, args, options),
  schedule: (callback, delayMs) => setTimeout(callback, delayMs),
  cancel: (timer) => clearTimeout(timer as NodeJS.Timeout),
};

export function buildSshTunnelArgs(config: SshTunnelConfig): string[] {
  if (typeof config.sshTarget !== "string" || !targetPattern.test(config.sshTarget)) throw new Error("SSH target is invalid");
  if (!validPort(config.localPort) || !validPort(config.remotePort)) throw new Error("Port must be an integer from 1 to 65535");
  return [
    "-N", "-T", "-o", "BatchMode=yes", "-o", "ExitOnForwardFailure=yes",
    "-o", "ServerAliveInterval=30", "-o", "ServerAliveCountMax=3",
    "-L", `127.0.0.1:${config.localPort}:127.0.0.1:${config.remotePort}`, config.sshTarget,
  ];
}

export class PlanApiSshTunnel {
  private args: string[] = [];
  private attempt = 0;
  private child: SshTunnelChild | null = null;
  private desired = false;
  private generation = 0;
  private listeners = new Set<(state: Readonly<SshTunnelState>) => void>();
  private retryScheduled = false;
  private status: SshTunnelState = { type: "stopped" };
  private timer: unknown;

  constructor(private readonly ports: SshTunnelPorts = nodePorts) {}

  start(config: SshTunnelConfig): void {
    this.generation += 1;
    this.desired = false;
    this.cancelRetry();
    this.stopChild();
    try { this.args = buildSshTunnelArgs(config); }
    catch (error) { this.setStatus({ type: "failed", message: messageOf(error) }); throw error; }
    this.desired = true;
    this.attempt = 0;
    this.launch(this.generation);
  }

  stop(): void {
    this.generation += 1;
    this.desired = false;
    this.cancelRetry();
    this.stopChild();
    this.setStatus({ type: "stopped" });
  }

  getStatus(): Readonly<SshTunnelState> { return { ...this.status }; }
  subscribe(listener: (state: Readonly<SshTunnelState>) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private launch(generation: number): void {
    if (!this.desired || generation !== this.generation) return;
    this.setStatus({ type: "starting" });
    let child: SshTunnelChild;
    try { child = this.ports.spawn("ssh", this.args, { shell: false, windowsHide: true }); }
    catch (error) { this.handleFailure(generation, null, error); return; }
    this.child = child;
    child.once("spawn", () => {
      if (!this.isCurrent(generation, child)) return;
      this.setStatus(child.pid === undefined ? { type: "running" } : { type: "running", pid: child.pid });
    });
    child.once("error", (error) => this.handleFailure(generation, child, error));
    child.once("exit", (code, signal) => this.handleFailure(generation, child, new Error(`SSH tunnel exited (${code ?? signal ?? "unknown"})`)));
  }

  private handleFailure(generation: number, child: SshTunnelChild | null, error: unknown): void {
    if (!this.desired || generation !== this.generation || this.retryScheduled || (child && this.child !== child)) return;
    if (child) this.child = null;
    this.attempt += 1;
    const message = messageOf(error);
    this.setStatus({ type: "reconnecting", attempt: this.attempt, message });
    this.retryScheduled = true;
    try {
      this.timer = this.ports.schedule(() => {
        this.retryScheduled = false;
        this.timer = undefined;
        this.launch(generation);
      }, RETRY_DELAYS[Math.min(this.attempt - 1, RETRY_DELAYS.length - 1)]);
    } catch (scheduleError) {
      this.retryScheduled = false;
      this.timer = undefined;
      this.desired = false;
      this.setStatus({ type: "failed", message: messageOf(scheduleError) });
    }
  }

  private cancelRetry(): void {
    if (!this.retryScheduled) return;
    this.retryScheduled = false;
    try { this.ports.cancel(this.timer); } catch { /* stopped is still terminal */ }
    this.timer = undefined;
  }
  private stopChild(): void {
    const child = this.child;
    this.child = null;
    if (child) try { child.kill(); } catch { /* child may already be gone */ }
  }
  private isCurrent(generation: number, child: SshTunnelChild): boolean {
    return this.desired && generation === this.generation && this.child === child;
  }
  private setStatus(status: SshTunnelState): void {
    if (sameState(this.status, status)) return;
    this.status = status;
    for (const listener of this.listeners) listener(this.getStatus());
  }
}

function validPort(value: number): boolean { return Number.isInteger(value) && value >= 1 && value <= 65535; }
function messageOf(error: unknown): string { return error instanceof Error ? error.message : String(error); }
function sameState(left: SshTunnelState, right: SshTunnelState): boolean { return JSON.stringify(left) === JSON.stringify(right); }
