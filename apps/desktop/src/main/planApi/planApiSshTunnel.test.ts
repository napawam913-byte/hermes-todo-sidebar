import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { PlanApiSshTunnel, buildSshTunnelArgs, type SshTunnelChild } from "./planApiSshTunnel.js";

class FakeChild extends EventEmitter {
  pid = 4321;
  kill = vi.fn(() => true);
}
type Timer = { run(): void; cancelled: boolean };
function ports(children: FakeChild[] = []) {
  const timers: Timer[] = [];
  const spawn = vi.fn(() => children.shift() as unknown as SshTunnelChild);
  const schedule = vi.fn((run: () => void, _delay: number): Timer => ({ run, cancelled: false }));
  const cancel = vi.fn((timer: Timer) => { timer.cancelled = true; });
  schedule.mockImplementation((run, _delay) => { const timer = { run, cancelled: false }; timers.push(timer); return timer; });
  return { spawn, schedule, cancel, timers };
}
const config = { sshTarget: "hermes-plan", localPort: 8743, remotePort: 8743 };
const child = () => new FakeChild();

describe("PlanApiSshTunnel", () => {
  it("builds a non-interactive localhost tunnel without a shell", () => {
    const process = child(); const p = ports([process]);
    const tunnel = new PlanApiSshTunnel(p);
    tunnel.start(config);
    expect(buildSshTunnelArgs(config)).toEqual(["-N", "-T", "-o", "BatchMode=yes", "-o", "ExitOnForwardFailure=yes", "-o", "ServerAliveInterval=30", "-o", "ServerAliveCountMax=3", "-L", "127.0.0.1:8743:127.0.0.1:8743", "hermes-plan"]);
    expect(p.spawn).toHaveBeenCalledWith("ssh", buildSshTunnelArgs(config), expect.objectContaining({ shell: false, windowsHide: true }));
    tunnel.stop(); expect(process.kill).toHaveBeenCalledOnce();
  });

  it("rejects unsafe targets and ports, then exposes failure", () => {
    expect(() => buildSshTunnelArgs({ ...config, sshTarget: "bad host" })).toThrow(/target/i);
    expect(() => buildSshTunnelArgs({ ...config, sshTarget: undefined as never })).toThrow(/target/i);
    expect(() => buildSshTunnelArgs({ ...config, localPort: 0 })).toThrow(/port/i);
    const tunnel = new PlanApiSshTunnel(ports());
    expect(() => tunnel.start({ ...config, remotePort: 65_536 })).toThrow(/port/i);
    expect(tunnel.getStatus()).toEqual({ type: "failed", message: expect.stringMatching(/port/i) });
  });

  it("becomes running only after its child spawns", () => {
    const process = child(); const tunnel = new PlanApiSshTunnel(ports([process]));
    tunnel.start(config); expect(tunnel.getStatus()).toEqual({ type: "starting" });
    process.emit("spawn"); expect(tunnel.getStatus()).toEqual({ type: "running", pid: 4321 });
  });

  it("schedules only one reconnect when error and exit both arrive", () => {
    const process = child(); const p = ports([process]); const tunnel = new PlanApiSshTunnel(p);
    tunnel.start(config); process.emit("error", new Error("lost")); process.emit("exit", 1, null);
    expect(p.schedule).toHaveBeenCalledOnce();
    expect(tunnel.getStatus()).toEqual({ type: "reconnecting", attempt: 1, message: "lost" });
  });

  it("uses the complete retry backoff sequence", () => {
    const processes = Array.from({ length: 7 }, child); const p = ports([...processes]); const tunnel = new PlanApiSshTunnel(p);
    tunnel.start(config);
    for (let index = 0; index < 6; index += 1) { processes[index].emit("error", new Error(`lost-${index}`)); p.timers[index].run(); }
    expect(p.schedule.mock.calls.map(([, delay]) => delay)).toEqual([1000, 2000, 5000, 10000, 30000, 30000]);
  });

  it("cancels retries and never reconnects after explicit stop", () => {
    const process = child(); const p = ports([process]); const tunnel = new PlanApiSshTunnel(p);
    tunnel.start(config); process.emit("error", new Error("lost")); tunnel.stop(); process.emit("exit", 1, null);
    expect(p.cancel).toHaveBeenCalledWith(p.timers[0]);
    expect(p.spawn).toHaveBeenCalledOnce(); expect(tunnel.getStatus()).toEqual({ type: "stopped" });
  });

  it("ignores events from a replaced child generation", () => {
    const oldChild = child(); const nextChild = child(); const p = ports([oldChild, nextChild]); const tunnel = new PlanApiSshTunnel(p);
    tunnel.start(config); oldChild.emit("spawn"); tunnel.start({ ...config, localPort: 8744 });
    oldChild.emit("error", new Error("late")); oldChild.emit("exit", 1, null); nextChild.emit("spawn");
    expect(oldChild.kill).toHaveBeenCalledOnce(); expect(p.schedule).not.toHaveBeenCalled();
    expect(tunnel.getStatus()).toEqual({ type: "running", pid: 4321 });
  });

  it("notifies subscribed listeners once per state change and supports unsubscribe", () => {
    const process = child(); const tunnel = new PlanApiSshTunnel(ports([process])); const listener = vi.fn();
    const unsubscribe = tunnel.subscribe(listener); tunnel.start(config); process.emit("spawn"); unsubscribe(); process.emit("error", new Error("lost"));
    expect(listener.mock.calls.map(([state]) => state.type)).toEqual(["starting", "running"]);
  });

  it("fails safely when scheduling fails and can start again", () => {
    const first = child(); const second = child(); const p = ports([first, second]); p.schedule.mockImplementation(() => { throw new Error("timer unavailable"); });
    const tunnel = new PlanApiSshTunnel(p); tunnel.start(config); first.emit("error", new Error("lost"));
    expect(tunnel.getStatus()).toEqual({ type: "failed", message: "timer unavailable" });
    tunnel.start(config); second.emit("spawn"); expect(tunnel.getStatus()).toEqual({ type: "running", pid: 4321 });
  });
});
