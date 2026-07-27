import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { PlanApiSshTunnel, buildSshTunnelArgs, type SshTunnelChild } from "./planApiSshTunnel.js";

class FakeChild extends EventEmitter { pid = 4321; kill = vi.fn(() => true); }
type Timer = { run(): void; cancelled: boolean };
function ports(children: FakeChild[] = []) {
  const timers: Timer[] = [];
  const spawn = vi.fn(() => children.shift() as unknown as SshTunnelChild);
  const schedule = vi.fn((run: () => void, _delay: number) => { const timer = { run, cancelled: false }; timers.push(timer); return timer; });
  const cancel = vi.fn((timer: Timer) => { timer.cancelled = true; });
  return { spawn, schedule, cancel, timers };
}
const config = { sshTarget: "hermes-plan", localPort: 8743, remotePort: 8743 };
const child = () => new FakeChild();
const terminal = (process: FakeChild) => { process.emit("close", 1, null); };

describe("PlanApiSshTunnel", () => {
  it("builds a non-interactive localhost tunnel without a shell", () => {
    const process = child(); const p = ports([process]); const tunnel = new PlanApiSshTunnel(p);
    tunnel.start(config);
    expect(buildSshTunnelArgs(config)).toEqual(["-N", "-T", "-o", "BatchMode=yes", "-o", "ExitOnForwardFailure=yes", "-o", "ServerAliveInterval=30", "-o", "ServerAliveCountMax=3", "-L", "127.0.0.1:8743:127.0.0.1:8743", "hermes-plan"]);
    expect(p.spawn).toHaveBeenCalledWith("ssh", buildSshTunnelArgs(config), expect.objectContaining({ shell: false, windowsHide: true }));
    tunnel.stop(); expect(process.kill).toHaveBeenCalledOnce();
  });

  it("rejects unsafe targets and ports, then exposes failure", () => {
    for (const sshTarget of ["bad host", "-V", undefined]) expect(() => buildSshTunnelArgs({ ...config, sshTarget: sshTarget as never })).toThrow(/target/i);
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

  it("waits for close after error and de-duplicates exit plus close", () => {
    const process = child(); const p = ports([process]); const tunnel = new PlanApiSshTunnel(p);
    tunnel.start(config); process.emit("spawn"); process.emit("error", new Error("lost"));
    expect(p.schedule).not.toHaveBeenCalled(); terminal(process); process.emit("exit", 1, null);
    expect(p.schedule).toHaveBeenCalledOnce(); expect(tunnel.getStatus()).toEqual({ type: "reconnecting", attempt: 1, message: "lost" });
  });

  it("retains an erroring child for stop until it closes", () => {
    const process = child(); const p = ports([process]); const tunnel = new PlanApiSshTunnel(p);
    tunnel.start(config); process.emit("error", new Error("lost")); tunnel.stop(); terminal(process);
    expect(process.kill).toHaveBeenCalledOnce(); expect(p.schedule).not.toHaveBeenCalled();
    expect(tunnel.getStatus()).toEqual({ type: "stopped" });
  });

  it("does not start a replacement when killing the old child fails", () => {
    for (const result of [false, new Error("kill denied")]) {
      const first = child(); const second = child(); first.kill.mockImplementation(() => { if (result instanceof Error) throw result; return result; });
      const p = ports([first, second]); const tunnel = new PlanApiSshTunnel(p);
      tunnel.start(config); tunnel.stop(); tunnel.start({ ...config, localPort: 8744 });
      expect(p.spawn).toHaveBeenCalledOnce(); expect(tunnel.getStatus()).toEqual({ type: "failed", message: expect.stringMatching(/kill|stop/i) });
    }
  });

  it("starts a replacement only after the previous child closes", () => {
    const first = child(); const second = child(); const p = ports([first, second]); const tunnel = new PlanApiSshTunnel(p);
    tunnel.start(config); tunnel.start({ ...config, localPort: 8744 });
    expect(p.spawn).toHaveBeenCalledOnce(); terminal(first); second.emit("spawn");
    expect(p.spawn).toHaveBeenCalledTimes(2); expect(tunnel.getStatus()).toEqual({ type: "running", pid: 4321 });
  });

  it("uses the complete retry backoff sequence", () => {
    const processes = Array.from({ length: 7 }, child); const p = ports([...processes]); const tunnel = new PlanApiSshTunnel(p);
    tunnel.start(config);
    for (let index = 0; index < 6; index += 1) { processes[index].emit("error", new Error(`lost-${index}`)); terminal(processes[index]); p.timers[index].run(); }
    expect(p.schedule.mock.calls.map(([, delay]) => delay)).toEqual([1000, 2000, 5000, 10000, 30000, 30000]);
  });

  it("isolates throwing listeners and honors a listener stop during starting", () => {
    const process = child(); const p = ports([process]); const tunnel = new PlanApiSshTunnel(p);
    tunnel.subscribe(() => { throw new Error("observer"); }); tunnel.start(config); process.emit("error", new Error("lost")); terminal(process);
    expect(p.spawn).toHaveBeenCalledOnce(); expect(p.schedule).toHaveBeenCalledOnce();
    const stoppedPorts = ports([child()]); const stopped = new PlanApiSshTunnel(stoppedPorts); stopped.subscribe((state) => { if (state.type === "starting") stopped.stop(); }); stopped.start(config);
    expect(stopped.getStatus()).toEqual({ type: "stopped" }); expect(stoppedPorts.spawn).not.toHaveBeenCalled();
  });

  it("keeps a newer timer owned when a cancelled callback arrives late", () => {
    const first = child(); const second = child(); const p = ports([first, second]); const tunnel = new PlanApiSshTunnel(p);
    tunnel.start(config); terminal(first); const oldTimer = p.timers[0]; p.cancel.mockImplementationOnce(() => { throw new Error("late cancel"); }); tunnel.start(config); terminal(second); const currentTimer = p.timers[1];
    oldTimer.run(); tunnel.stop(); expect(p.cancel).toHaveBeenCalledWith(currentTimer);
  });

  it("supports unsubscribe and recovers from a scheduler failure", () => {
    const first = child(); const second = child(); const p = ports([first, second]); p.schedule.mockImplementationOnce(() => { throw new Error("timer unavailable"); });
    const tunnel = new PlanApiSshTunnel(p); const listener = vi.fn(); const unsubscribe = tunnel.subscribe(listener);
    tunnel.start(config); terminal(first); unsubscribe(); expect(tunnel.getStatus()).toEqual({ type: "failed", message: "timer unavailable" });
    tunnel.start(config); second.emit("spawn"); expect(listener.mock.calls.map(([state]) => state.type)).toEqual(["starting", "reconnecting", "failed"]);
  });

  it("keeps each task file within its own line limit", () => {
    for (const name of ["planApiSshTunnel.ts", "planApiSshTunnel.test.ts"]) expect(readFileSync(fileURLToPath(new URL(`./${name}`, import.meta.url)), "utf8").split(/\r?\n/).length).toBeLessThanOrEqual(220);
  });
});
