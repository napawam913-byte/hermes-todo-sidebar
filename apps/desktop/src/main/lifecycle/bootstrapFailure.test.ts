/**
 * 模块用途：锁定主进程启动阶段的顺序与安全失败行为。
 * 模块边界：只测试生命周期编排，不启动 Electron 窗口、托盘或真实 Plan API。
 */
import { describe, expect, it, vi } from "vitest";
import {
  BOOTSTRAP_FAILURE_MESSAGE,
  BOOTSTRAP_FAILURE_TITLE,
  reportBootstrapFailure,
  runBootstrapSequence
} from "./bootstrapFailure.js";

function createFailureHandler() {
  return {
    showError: vi.fn(),
    exit: vi.fn()
  };
}

describe("runBootstrapSequence", () => {
  it("reports a fixed safe message before explicitly exiting", () => {
    const failure = createFailureHandler();

    reportBootstrapFailure(failure);

    expect(failure.showError).toHaveBeenCalledWith(
      BOOTSTRAP_FAILURE_TITLE,
      BOOTSTRAP_FAILURE_MESSAGE
    );
    expect(failure.exit).toHaveBeenCalledWith(1);
    expect(failure.showError.mock.invocationCallOrder[0]).toBeLessThan(
      failure.exit.mock.invocationCallOrder[0]
    );
  });

  it("exits safely when Plan API initialization fails", async () => {
    const registerAi = vi.fn();
    const createDesktop = vi.fn();
    const failure = createFailureHandler();

    await runBootstrapSequence({
      initializePlanApi: vi.fn(async () => {
        throw new Error("token=secret baseUrl=http://private requestId=req_1");
      }),
      registerAi,
      createDesktop
    }, failure);

    expect(registerAi).not.toHaveBeenCalled();
    expect(createDesktop).not.toHaveBeenCalled();
    expect(failure.showError).toHaveBeenCalledWith(
      BOOTSTRAP_FAILURE_TITLE,
      BOOTSTRAP_FAILURE_MESSAGE
    );
    expect(failure.exit).toHaveBeenCalledOnce();
    expect(failure.exit).toHaveBeenCalledWith(1);
    expect(JSON.stringify(failure.showError.mock.calls)).not.toContain("secret");
  });

  it("does not create a window or tray when AI registration fails", async () => {
    const runtime = { id: "runtime" };
    const createDesktop = vi.fn();
    const failure = createFailureHandler();

    await runBootstrapSequence({
      initializePlanApi: vi.fn(async () => runtime),
      registerAi: vi.fn(() => {
        throw new Error("sshTarget=private-host");
      }),
      createDesktop
    }, failure);

    expect(createDesktop).not.toHaveBeenCalled();
    expect(failure.showError).toHaveBeenCalledWith(
      BOOTSTRAP_FAILURE_TITLE,
      BOOTSTRAP_FAILURE_MESSAGE
    );
    expect(failure.exit).toHaveBeenCalledWith(1);
    expect(JSON.stringify(failure.showError.mock.calls)).not.toContain("private-host");
  });

  it("creates the desktop only after initialization and AI registration", async () => {
    const calls: string[] = [];
    const runtime = { id: "runtime" };
    const failure = createFailureHandler();

    await runBootstrapSequence({
      initializePlanApi: vi.fn(async () => {
        calls.push("plan-api");
        return runtime;
      }),
      registerAi: vi.fn((value) => {
        expect(value).toBe(runtime);
        calls.push("ai");
      }),
      createDesktop: vi.fn(async (value) => {
        expect(value).toBe(runtime);
        calls.push("desktop");
      })
    }, failure);

    expect(calls).toEqual(["plan-api", "ai", "desktop"]);
    expect(failure.showError).not.toHaveBeenCalled();
    expect(failure.exit).not.toHaveBeenCalled();
  });
});
