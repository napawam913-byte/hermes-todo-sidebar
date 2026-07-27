import { describe, expect, it, vi } from "vitest";
import { PlanApiReconnectLoop } from "./planApiReconnectLoop.js";

type Timer = { run(): void };

function createPorts(sync = false) {
  const timers: Timer[] = [];
  const schedule = vi.fn((run: () => void) => {
    const timer = { run };
    timers.push(timer);
    if (sync) run();
    return timer;
  });
  return { timers, schedule, cancel: vi.fn() };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  return {
    promise: new Promise<T>((done) => { resolve = done; }),
    resolve,
  };
}

describe("PlanApiReconnectLoop", () => {
  it("uses bounded delays and resets only after a successful refresh", async () => {
    const ports = createPorts();
    const refresh = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const loop = new PlanApiReconnectLoop(refresh, ports);

    loop.start();
    loop.notifyOffline();
    ports.timers[0].run();
    await Promise.resolve();
    ports.timers[1].run();
    await Promise.resolve();
    loop.notifyOffline();

    expect(ports.schedule.mock.calls.map(([, delay]) => delay)).toEqual([1000, 2000, 1000]);
  });

  it("does not double schedule when a synchronous timer starts refresh", async () => {
    const ports = createPorts(true);
    const pending = deferred<boolean>();
    const loop = new PlanApiReconnectLoop(() => pending.promise, ports);

    loop.start();
    loop.notifyOffline();
    loop.notifyOffline();
    expect(ports.schedule).toHaveBeenCalledOnce();

    pending.resolve(true);
    await Promise.resolve();
    expect(ports.schedule).toHaveBeenCalledOnce();
  });

  it("ignores stale timers and late promises after shutdown", async () => {
    const ports = createPorts();
    const pending = deferred<boolean>();
    const loop = new PlanApiReconnectLoop(() => pending.promise, ports);

    loop.start();
    loop.notifyOffline();
    ports.timers[0].run();
    loop.shutdown();
    pending.resolve(false);
    await Promise.resolve();

    expect(ports.schedule).toHaveBeenCalledOnce();
    expect(ports.cancel).not.toHaveBeenCalled();
  });

  it("does not let an old refresh clear a newly started refresh session", async () => {
    const ports = createPorts();
    const oldRefresh = deferred<boolean>();
    const newRefresh = deferred<boolean>();
    const refresh = vi.fn()
      .mockReturnValueOnce(oldRefresh.promise)
      .mockReturnValueOnce(newRefresh.promise);
    const loop = new PlanApiReconnectLoop(refresh, ports);

    loop.start();
    loop.notifyOffline();
    ports.timers[0].run();
    loop.shutdown();
    loop.start();
    loop.notifyOffline();
    ports.timers[1].run();

    oldRefresh.resolve(false);
    await Promise.resolve();
    loop.notifyOffline();
    expect(ports.schedule).toHaveBeenCalledTimes(2);

    newRefresh.resolve(false);
    await Promise.resolve();
    expect(ports.schedule).toHaveBeenCalledTimes(3);
  });
});
