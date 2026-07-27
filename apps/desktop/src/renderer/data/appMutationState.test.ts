/**
 * 模块用途：验证 UI 只在持久化成功后接受新快照，失败时保留旧数据。
 * 模块边界：只测试纯状态转换，不挂载 React 或调用网关。
 */
import { describe, expect, it } from "vitest";
import { createMutationUiState, reduceMutationUiState } from "./appMutationState";

describe("appMutationState", () => {
  it("accepts a persisted snapshot only after success", () => {
    const initial = createMutationUiState({ todos: [], cyclePlans: [] });
    const busy = reduceMutationUiState(initial, { type: "mutation.started" });
    const success = reduceMutationUiState(busy, {
      type: "mutation.succeeded",
      snapshot: { todos: [{ id: "todo_1" } as never], cyclePlans: [] }
    });

    expect(busy).toMatchObject({ busy: true, error: null, snapshot: initial.snapshot });
    expect(success).toMatchObject({ busy: false, error: null });
    expect(success.snapshot.todos).toHaveLength(1);
  });

  it("keeps the previous snapshot when persistence fails", () => {
    const initial = createMutationUiState({
      todos: [{ id: "todo_existing" } as never], cyclePlans: []
    });
    const failed = reduceMutationUiState(initial, {
      type: "mutation.failed", message: "保存失败"
    });

    expect(failed.snapshot).toEqual(initial.snapshot);
    expect(failed).toMatchObject({ busy: false, error: "保存失败" });
  });
});
