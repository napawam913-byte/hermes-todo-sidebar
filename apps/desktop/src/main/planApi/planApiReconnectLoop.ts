/** 模块用途：以受控退避节奏触发只读刷新，不重放业务写入。 */
export interface PlanApiReconnectPorts { schedule(callback: () => void, delayMs: number): unknown; cancel(timer: unknown): void; }
const delays = [1000, 2000, 5000, 10000, 30000] as const;
const nodePorts: PlanApiReconnectPorts = { schedule: (run, ms) => setTimeout(run, ms), cancel: timer => clearTimeout(timer as NodeJS.Timeout) };
type Timer = { token: number; generation: number; handle: unknown };

export class PlanApiReconnectLoop {
  private active = false; private attempt = 0; private generation = 0; private token = 0;
  private timer: Timer | null = null; private inFlight = false;
  constructor(private readonly refresh: () => Promise<boolean>, private readonly ports: PlanApiReconnectPorts = nodePorts) {}
  start(): void { this.active = true; this.generation += 1; this.inFlight = false; }
  notifyOnline(): void { this.attempt = 0; this.generation += 1; this.cancel(); }
  notifyOffline(): void { if (this.active && !this.timer && !this.inFlight) this.schedule(); }
  shutdown(): void { this.active = false; this.generation += 1; this.cancel(); }
  private schedule(): void {
    if (!this.active || this.timer || this.inFlight) return;
    const timer: Timer = { token: ++this.token, generation: this.generation, handle: undefined };
    this.timer = timer; const delay = delays[Math.min(this.attempt++, delays.length - 1)];
    try { timer.handle = this.ports.schedule(() => this.fire(timer), delay); }
    catch { if (this.timer === timer) this.timer = null; }
  }
  private fire(timer: Timer): void {
    if (!this.active || this.timer !== timer || timer.generation !== this.generation || this.inFlight) return;
    this.timer = null; this.inFlight = true;
    void this.refresh().then(ok => this.finish(timer, ok), () => this.finish(timer, false));
  }
  private finish(timer: Timer, online: boolean): void {
    this.inFlight = false;
    if (!this.active || timer.generation !== this.generation) return;
    if (online) this.notifyOnline(); else this.schedule();
  }
  private cancel(): void { const timer = this.timer; this.timer = null; if (timer && timer.handle !== undefined) this.ports.cancel(timer.handle); }
}
