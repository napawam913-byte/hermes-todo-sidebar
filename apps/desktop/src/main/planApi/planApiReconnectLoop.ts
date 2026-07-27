/** 模块用途：以受控退避节奏触发只读刷新，不重放任何业务写入。 */
export interface PlanApiReconnectPorts {
  schedule(callback: () => void, delayMs: number): unknown;
  cancel(timer: unknown): void;
}

const delays = [1000, 2000, 5000, 10000, 30000] as const;
const nodePorts: PlanApiReconnectPorts = {
  schedule: (callback, delayMs) => setTimeout(callback, delayMs),
  cancel: timer => clearTimeout(timer as NodeJS.Timeout),
};

export class PlanApiReconnectLoop {
  private active = false;
  private attempt = 0;
  private timer: unknown = null;

  constructor(
    private readonly refresh: () => Promise<boolean>,
    private readonly ports: PlanApiReconnectPorts = nodePorts,
  ) {}

  start(): void { this.active = true; }
  notifyOnline(): void { this.attempt = 0; this.cancel(); }
  notifyOffline(): void { if (this.active && !this.timer) this.schedule(); }
  shutdown(): void { this.active = false; this.cancel(); }

  private schedule(): void {
    const delay = delays[Math.min(this.attempt, delays.length - 1)];
    this.attempt += 1;
    const timer = this.ports.schedule(() => this.fire(timer), delay);
    this.timer = timer;
  }

  private fire(timer: unknown): void {
    if (!this.active || this.timer !== timer) return;
    this.timer = null;
    void this.refresh().then(online => {
      if (!this.active) return;
      if (online) this.notifyOnline(); else this.schedule();
    }, () => { if (this.active) this.schedule(); });
  }

  private cancel(): void {
    const timer = this.timer; this.timer = null;
    if (timer !== null) this.ports.cancel(timer);
  }
}
