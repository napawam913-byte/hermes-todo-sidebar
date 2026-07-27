// @vitest-environment jsdom
/** 模块用途：验证写入失败通知在真实 React 挂载中订阅、重试并消失。 */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type { RepositoryWriteController, RepositoryWriteState } from "../data/electronRepositories";
import { RepositoryWriteNotice } from "./RepositoryWriteNotice";

function controller() {
  let state: RepositoryWriteState = Object.freeze({ pending: false });
  const listeners = new Set<(next: RepositoryWriteState) => void>();
  const retryPending = vi.fn();
  return {
    getWriteState: () => state,
    onWriteStateChanged(listener: (next: RepositoryWriteState) => void) {
      listeners.add(listener); return () => listeners.delete(listener);
    },
    retryPending,
    setState(next: RepositoryWriteState) {
      state = Object.freeze({ ...next }); listeners.forEach((listener) => listener(state));
    }
  } satisfies RepositoryWriteController & { setState(next: RepositoryWriteState): void };
}

describe("RepositoryWriteNotice", () => {
  it("mounts, shows a subscribed failure, retries, and disappears after success", async () => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const port = controller(); const container = document.createElement("div"); const root = createRoot(container);
    await act(async () => { root.render(<RepositoryWriteNotice controller={port} />); });
    expect(container.querySelector('[role="alert"]')).toBeNull();

    await act(async () => { port.setState({ pending: false, error: "offline" }); });
    expect(container.textContent).toContain("未保存到 Plan API：offline");
    await act(async () => { container.querySelector("button")?.click(); });
    expect(port.retryPending).toHaveBeenCalledOnce();

    await act(async () => { port.setState({ pending: false }); });
    expect(container.querySelector('[role="alert"]')).toBeNull();
    await act(async () => { root.unmount(); });
  });
});
