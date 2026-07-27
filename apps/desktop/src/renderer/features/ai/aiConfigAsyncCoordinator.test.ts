/**
 * 模块用途：验证配置草稿保存串行执行，过期连接测试不会覆盖新字段状态。
 * 模块边界：只测试异步顺序，不挂载 React，也不调用 Electron IPC。
 */
import { describe, expect, it, vi } from "vitest";
import { AiConfigAsyncCoordinator } from "./aiConfigAsyncCoordinator";

describe("AiConfigAsyncCoordinator", () => {
  it("serializes draft writes and waits for the complete queue", async () => {
    const coordinator = new AiConfigAsyncCoordinator();
    let releaseFirst: () => void = () => undefined;
    const first = vi.fn(() => new Promise<void>((resolve) => {
      releaseFirst = resolve;
    }));
    const second = vi.fn(async () => undefined);

    const firstResult = coordinator.enqueueDraft(first);
    const secondResult = coordinator.enqueueDraft(second);
    await Promise.resolve();
    expect(first).toHaveBeenCalledOnce();
    expect(second).not.toHaveBeenCalled();

    releaseFirst();
    await Promise.all([firstResult, secondResult, coordinator.waitForDrafts()]);
    expect(second).toHaveBeenCalledOnce();
  });

  it("invalidates an older connection request after a field changes", () => {
    const coordinator = new AiConfigAsyncCoordinator();
    const request = coordinator.beginConnection();
    expect(coordinator.isCurrentConnection(request)).toBe(true);
    coordinator.invalidateConnection();
    expect(coordinator.isCurrentConnection(request)).toBe(false);
  });

  it("detects fields changed while a formal save is running", () => {
    const coordinator = new AiConfigAsyncCoordinator();
    const revision = coordinator.getFormRevision();
    expect(coordinator.isCurrentForm(revision)).toBe(true);
    coordinator.markFieldChanged();
    expect(coordinator.isCurrentForm(revision)).toBe(false);
  });
});
