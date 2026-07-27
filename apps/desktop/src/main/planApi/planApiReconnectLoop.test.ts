import { describe, expect, it, vi } from "vitest";
import { PlanApiReconnectLoop } from "./planApiReconnectLoop.js";

type Timer = { run(): void };
const ports = (sync = false) => {
  const timers: Timer[] = [];
  const schedule = vi.fn((run: () => void) => { const timer = { run }; timers.push(timer); if (sync) run(); return timer; });
  return { timers, schedule, cancel: vi.fn() };
};
const deferred = <T>() => { let resolve!: (value: T) => void; return { promise: new Promise<T>(done => { resolve = done; }), resolve }; };

describe("PlanApiReconnectLoop", () => {
  it("uses bounded delays and resets only after a successful refresh", async () => {
    const p = ports(); const refresh = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const loop = new PlanApiReconnectLoop(refresh, p); loop.start(); loop.notifyOffline();
    p.timers[0].run(); await Promise.resolve(); p.timers[1].run(); await Promise.resolve(); loop.notifyOffline();
    expect(p.schedule.mock.calls.map(([, delay]) => delay)).toEqual([1000, 2000, 1000]);
  });

  it("handles a synchronous scheduler and never double-schedules while refresh is in flight", async () => {
    const p = ports(true); const pending = deferred<boolean>(); const loop = new PlanApiReconnectLoop(() => pending.promise, p);
    loop.start(); loop.notifyOffline(); loop.notifyOffline();
    expect(p.schedule).toHaveBeenCalledOnce(); pending.resolve(true); await Promise.resolve();
    expect(p.schedule).toHaveBeenCalledOnce();
  });

  it("ignores stale timers and late promises after shutdown", async () => {
    const p = ports(); const pending = deferred<boolean>(); const loop = new PlanApiReconnectLoop(() => pending.promise, p);
    loop.start(); loop.notifyOffline(); p.timers[0].run(); loop.shutdown(); pending.resolve(false); await Promise.resolve();
    expect(p.schedule).toHaveBeenCalledOnce(); expect(p.cancel).not.toHaveBeenCalled();
  });

  it("clears in-flight work when refresh itself reports online", async () => {
    const p = ports(); let loop!: PlanApiReconnectLoop;
    loop = new PlanApiReconnectLoop(async () => { loop.notifyOnline(); return true; }, p); loop.start(); loop.notifyOffline(); p.timers[0].run(); await Promise.resolve(); loop.notifyOffline();
    expect(p.schedule).toHaveBeenCalledTimes(2);
  });
});
