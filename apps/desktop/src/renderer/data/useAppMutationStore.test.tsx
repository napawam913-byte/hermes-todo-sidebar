// @vitest-environment jsdom
/**
 * 模块用途：验证 App 可同步报告只读拦截错误，而不执行持久化网关。
 * 模块边界：只挂载 mutation hook，不渲染业务页面。
 */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { useAppMutationStore } from "./useAppMutationStore";

describe("useAppMutationStore", () => {
  it("reports a defensive read-only error without invoking the gateway", async () => {
    const execute = vi.fn();
    let current: ReturnType<typeof useAppMutationStore> | null = null;
    const container = document.createElement("div");
    const root = createRoot(container);
    (globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean;
    }).IS_REACT_ACT_ENVIRONMENT = true;

    function Probe() {
      current = useAppMutationStore({
        gateway: { canMutate: () => false, execute },
        initialState: { todos: [], cyclePlans: [] }
      });
      return null;
    }

    await act(async () => root.render(<Probe />));
    act(() => {
      readController().reportError("数据服务离线，当前仅可查看");
    });

    expect(readController().error).toBe("数据服务离线，当前仅可查看");
    expect(execute).not.toHaveBeenCalled();
    await act(async () => root.unmount());

    function readController() {
      if (!current) throw new Error("mutation store 尚未挂载");
      return current;
    }
  });
});
