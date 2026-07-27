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
  once(event: "exit" | "close", listener: (code: number | null, signal: NodeJS.Signals | null) => void): unknown;
}
export interface SshTunnelPorts {
  spawn(command: string, args: string[], options: SpawnOptions): SshTunnelChild;
  schedule(callback: () => void, delayMs: number): unknown;
  cancel(timer: unknown): void;
}
type Session = { child: SshTunnelChild; generation: number; terminal: boolean; stopRequested: boolean; stopError?: string; pendingError?: string };
type RetryTimer = { generation: number; token: number; handle: unknown };
type PendingStart = { args: string[]; generation: number };

const RETRY_DELAYS = [1000, 2000, 5000, 10000, 30000] as const;
const targetPattern = /^[A-Za-z0-9._@:-]+$/;
const nodePorts: SshTunnelPorts = {
  spawn: (command, args, options) => nodeSpawn(command, args, options),
  schedule: (callback, delayMs) => setTimeout(callback, delayMs),
  cancel: (timer) => clearTimeout(timer as NodeJS.Timeout),
};

export function buildSshTunnelArgs(config: SshTunnelConfig): string[] {
  if (typeof config.sshTarget !== "string" || config.sshTarget.startsWith("-") || !targetPattern.test(config.sshTarget)) throw new Error("SSH target is invalid");
  if (!validPort(config.localPort) || !validPort(config.remotePort)) throw new Error("Port must be an integer from 1 to 65535");
  return ["-N", "-T", "-o", "BatchMode=yes", "-o", "ExitOnForwardFailure=yes", "-o", "ServerAliveInterval=30", "-o", "ServerAliveCountMax=3", "-L", `127.0.0.1:${config.localPort}:127.0.0.1:${config.remotePort}`, config.sshTarget];
}

export class PlanApiSshTunnel {
  private active: Session | null = null;
  private args: string[] = [];
  private attempt = 0;
  private desired = false;
  private generation = 0;
  private listeners = new Set<(state: Readonly<SshTunnelState>) => void>();
  private pending: PendingStart | null = null;
  private status: SshTunnelState = { type: "stopped" };
  private timer: RetryTimer | null = null;
  private timerToken = 0;

  constructor(private readonly ports: SshTunnelPorts = nodePorts) {}

  start(config: SshTunnelConfig): void {
    this.generation += 1;
    this.desired = false;
    this.pending = null;
    this.cancelRetry();
    let args: string[];
    try { args = buildSshTunnelArgs(config); }
    catch (error) { this.setStatus({ type: "failed", message: messageOf(error) }); throw error; }
    this.args = args;
    this.attempt = 0;
    this.desired = true;
    if (!this.active) { this.launch(this.generation); return; }
    this.pending = { args, generation: this.generation };
    const failure = this.requestStop(this.active);
    if (failure) { this.pending = null; this.desired = false; this.setStatus({ type: "failed", message: failure }); return; }
    this.setStatus({ type: "stopped" });
  }

  stop(): void {
    this.generation += 1;
    this.desired = false;
    this.pending = null;
    this.cancelRetry();
    const failure = this.active ? this.requestStop(this.active) : null;
    this.setStatus(failure ? { type: "failed", message: failure } : { type: "stopped" });
  }

  getStatus(): Readonly<SshTunnelState> { return { ...this.status }; }
  subscribe(listener: (state: Readonly<SshTunnelState>) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }

  private launch(generation: number): void {
    if (!this.canContinue(generation) || this.active) return;
    this.setStatus({ type: "starting" });
    if (!this.canContinue(generation) || this.active) return;
    let child: SshTunnelChild;
    try { child = this.ports.spawn("ssh", this.args, { shell: false, windowsHide: true }); }
    catch (error) { this.retry(generation, messageOf(error)); return; }
    const session: Session = { child, generation, terminal: false, stopRequested: false };
    this.active = session;
    child.once("spawn", () => {
      if (!this.isActive(session) || !this.canContinue(generation)) return;
      this.setStatus(child.pid === undefined ? { type: "running" } : { type: "running", pid: child.pid });
    });
    child.once("error", (error) => { if (this.isActive(session)) session.pendingError = messageOf(error); });
    child.once("exit", (code, signal) => this.finish(session, `SSH tunnel exited (${code ?? signal ?? "unknown"})`));
    child.once("close", (code, signal) => this.finish(session, `SSH tunnel closed (${code ?? signal ?? "unknown"})`));
  }

  private finish(session: Session, fallback: string): void {
    if (session.terminal) return;
    if (this.active !== session) return;
    session.terminal = true;
    this.active = null;
    const pending = this.pending;
    if (pending && pending.generation === this.generation && this.desired) {
      this.pending = null;
      this.args = pending.args;
      this.attempt = 0;
      this.launch(pending.generation);
      return;
    }
    if (!session.stopRequested && this.canContinue(session.generation)) this.retry(session.generation, session.pendingError ?? fallback);
  }

  private retry(generation: number, message: string): void {
    if (!this.canContinue(generation)) return;
    this.attempt += 1;
    this.setStatus({ type: "reconnecting", attempt: this.attempt, message });
    if (!this.canContinue(generation) || this.active) return;
    const timer: RetryTimer = { generation, token: ++this.timerToken, handle: undefined };
    this.timer = timer;
    try { timer.handle = this.ports.schedule(() => this.fireTimer(timer), RETRY_DELAYS[Math.min(this.attempt - 1, RETRY_DELAYS.length - 1)]); }
    catch (error) {
      if (this.timer !== timer) return;
      this.timer = null;
      this.desired = false;
      this.setStatus({ type: "failed", message: messageOf(error) });
    }
  }

  private fireTimer(timer: RetryTimer): void {
    if (this.timer !== timer || timer.generation !== this.generation || !this.desired) return;
    this.timer = null;
    this.launch(timer.generation);
  }
  private cancelRetry(): void {
    const timer = this.timer;
    this.timer = null;
    if (!timer) return;
    try { this.ports.cancel(timer.handle); } catch { /* token ownership makes late callbacks inert */ }
  }
  private requestStop(session: Session): string | null {
    if (session.stopRequested) return session.stopError ?? null;
    session.stopRequested = true;
    try { if (session.child.kill()) return null; }
    catch (error) { session.stopError = messageOf(error); return session.stopError; }
    session.stopError = "SSH tunnel stop was rejected";
    return session.stopError;
  }
  private canContinue(generation: number): boolean { return this.desired && generation === this.generation; }
  private isActive(session: Session): boolean { return this.active === session && !session.terminal; }
  private setStatus(status: SshTunnelState): void {
    if (sameState(this.status, status)) return;
    this.status = status;
    for (const listener of this.listeners) try { listener(this.getStatus()); } catch { /* observers cannot break lifecycle work */ }
  }
}

function validPort(value: number): boolean { return Number.isInteger(value) && value >= 1 && value <= 65535; }
function messageOf(error: unknown): string { return error instanceof Error ? error.message : String(error); }
function sameState(left: SshTunnelState, right: SshTunnelState): boolean { return JSON.stringify(left) === JSON.stringify(right); }
