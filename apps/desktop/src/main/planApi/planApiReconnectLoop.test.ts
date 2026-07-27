import { describe, expect, it, vi } from "vitest";
import { PlanApiReconnectLoop } from "./planApiReconnectLoop.js";

type Timer = { run: () => void; cancelled: boolean };

function ports() {
  const timers: Timer[] = [];
  return {
    timers,
    schedule: vi.fn((run: () => void) => {
      const timer = { run, cancelled: false }; timers.push(timer); return timer;
    }),
    cancel: vi.fn((timer: Timer) => { timer.cancelled = true; }),
  };
}

describe("PlanApiReconnectLoop", () => {
  it("uses the bounded retry delays and resets after a successful refresh", async () => {
    const p = ports(); const refresh = vi.fn()
      .mockResolvedValueOnce(false).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const loop = new PlanApiReconnectLoop(refresh, p);
    loop.start(); loop.notifyOffline();
    expect(p.schedule.mock.calls.map(([, delay]) => delay)).toEqual([1000]);
    p.timers[0].run(); await Promise.resolve();
    expect(p.schedule.mock.calls.map(([, delay]) => delay)).toEqual([1000, 2000]);
    p.timers[1].run(); await Promise.resolve();
    expect(p.schedule.mock.calls.map(([, delay]) => delay)).toEqual([1000, 2000, 5000]);
    p.timers[2].run(); await Promise.resolve();
    loop.notifyOffline();
    expect(p.schedule.mock.calls.at(-1)?.[1]).toBe(1000);
  });

  it("never schedules after shutdown, including late timer callbacks", async () => {
    const p = ports(); const loop = new PlanApiReconnectLoop(async () => false, p);
    loop.start(); loop.notifyOffline(); const timer = p.timers[0]; loop.shutdown();
    timer.run(); await Promise.resolve();
    expect(p.cancel).toHaveBeenCalledWith(timer);
    expect(p.schedule).toHaveBeenCalledTimes(1);
  });
});
