/**
 * 模块用途：验证待办和周期计划更新经过串行服务后不会互相覆盖。
 * 模块边界：使用内存存储替身，不测试文件系统细节或 Electron IPC。
 */
import { describe, expect, it } from "vitest";
import { AppStateService, type AppStatePersistence } from "./appStateService.js";
import { createEmptyAppState, type StoredAppStateV1 } from "./appStateTypes.js";

function createMemoryPersistence(): AppStatePersistence & { saved: StoredAppStateV1[] } {
  const saved: StoredAppStateV1[] = [];
  return {
    saved,
    async load() {
      return createEmptyAppState();
    },
    async save(state) {
      saved.push(structuredClone(state));
    },
    async exportTo() {},
    async importFrom() {
      return createEmptyAppState();
    }
  };
}

describe("AppStateService", () => {
  it("serializes todo and cycle plan updates into one state", async () => {
    const persistence = createMemoryPersistence();
    const service = new AppStateService(persistence);
    await service.initialize();

    await Promise.all([
      service.replaceTodos([{ id: "todo_1" }]),
      service.replaceCyclePlans([{ id: "plan_1" }])
    ]);

    expect(service.getSnapshot()).toMatchObject({
      todos: [{ id: "todo_1" }],
      cyclePlans: [{ id: "plan_1" }]
    });
    expect(persistence.saved.at(-1)).toMatchObject({
      todos: [{ id: "todo_1" }],
      cyclePlans: [{ id: "plan_1" }]
    });
  });
});
