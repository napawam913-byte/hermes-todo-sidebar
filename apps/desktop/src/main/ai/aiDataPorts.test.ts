/**
 * 模块用途：验证 Plan API runtime 通过显式适配器收敛为 AI 最小数据端口。
 * 模块边界：不构造 Electron、连接配置、令牌或缓存对象。
 */
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import type { AppMutationBatch } from "../../shared/appMutationTypes.js";
import type { RegisteredPlanApiRuntime } from "../planApi/planApiBootstrap.js";
import type { StoredAppStateV1 } from "../storage/appStateTypes.js";
import {
  createAiDataPorts,
  type AiMutationPort,
  type AiSnapshotPort
} from "./aiDataPorts.js";

const snapshot: StoredAppStateV1 = {
  schemaVersion: 1,
  todos: [{ id: "todo_snapshot" }],
  cyclePlans: [],
  settings: { launchAtLogin: false },
  updatedAt: "2026-07-28T08:00:00.000Z"
};

const mutationResult: StoredAppStateV1 = {
  ...snapshot,
  todos: [{ id: "todo_after_mutation" }],
  updatedAt: "2026-07-28T08:01:00.000Z"
};

const batch: AppMutationBatch = {
  source: { type: "ai_draft", proposalId: "proposal_1" },
  summary: "创建今日待办",
  operations: []
};

describe("createAiDataPorts", () => {
  it("adapts runtime names and forwards snapshot and mutation exactly once", async () => {
    const runtime = {
      getStoredSnapshot: vi.fn(async () => snapshot),
      execute: vi.fn(async () => mutationResult)
    } satisfies Pick<
      RegisteredPlanApiRuntime,
      "getStoredSnapshot" | "execute"
    >;

    const ports = createAiDataPorts(runtime);

    await expect(ports.snapshotPort.getSnapshot()).resolves.toBe(snapshot);
    await expect(ports.mutationPort.execute(batch)).resolves.toBe(mutationResult);
    expect(runtime.getStoredSnapshot).toHaveBeenCalledOnce();
    expect(runtime.execute).toHaveBeenCalledOnce();
    expect(runtime.execute).toHaveBeenCalledWith(batch);
  });

  it("exposes only the two minimal AI contracts", () => {
    expectTypeOf<keyof AiSnapshotPort>().toEqualTypeOf<"getSnapshot">();
    expectTypeOf<keyof AiMutationPort>().toEqualTypeOf<"execute">();
  });
});
