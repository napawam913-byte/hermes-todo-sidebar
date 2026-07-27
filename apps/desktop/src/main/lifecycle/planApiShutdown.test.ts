/** 模块用途：验证退出协调不会递归或遗漏 runtime 清理。 */
import { describe, expect, it, vi } from "vitest";
import { createPlanApiBeforeQuitHandler } from "./planApiShutdown.js";

describe("createPlanApiBeforeQuitHandler", () => {
  it("waits for one shutdown before one final quit", async () => {
    let finish: (() => void) | undefined;
    const shutdown = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    const quit = vi.fn();
    const handler = createPlanApiBeforeQuitHandler(() => ({ shutdown }), quit);
    const first = { preventDefault: vi.fn() };
    const duplicate = { preventDefault: vi.fn() };

    handler(first);
    handler(duplicate);
    expect(first.preventDefault).toHaveBeenCalledOnce();
    expect(duplicate.preventDefault).toHaveBeenCalledOnce();
    expect(shutdown).toHaveBeenCalledOnce();
    expect(quit).not.toHaveBeenCalled();

    finish?.();
    await Promise.resolve();
    await Promise.resolve();
    expect(quit).toHaveBeenCalledOnce();
    handler({ preventDefault: vi.fn() });
    expect(quit).toHaveBeenCalledOnce();
  });
});
