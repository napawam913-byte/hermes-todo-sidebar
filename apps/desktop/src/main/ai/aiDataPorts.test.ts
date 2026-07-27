/**
 * 模块用途：锁定 AI 只能访问最小快照与变更端口，并验证 Plan API runtime 的类型兼容性。
 * 模块边界：不构造 Electron、连接配置、令牌或缓存对象。
 */
import { describe, expectTypeOf, it } from "vitest";
import type { RegisteredPlanApiRuntime } from "../planApi/planApiBootstrap.js";
import type { AiMutationPort, AiSnapshotPort } from "./aiDataPorts.js";

describe("AI data ports", () => {
  it("accepts the registered Plan API runtime without exposing infrastructure", () => {
    expectTypeOf<RegisteredPlanApiRuntime>().toMatchTypeOf<AiSnapshotPort>();
    expectTypeOf<RegisteredPlanApiRuntime>().toMatchTypeOf<AiMutationPort>();
    expectTypeOf<keyof AiSnapshotPort>().toEqualTypeOf<"getSnapshot">();
    expectTypeOf<keyof AiMutationPort>().toEqualTypeOf<"execute">();
  });
});
