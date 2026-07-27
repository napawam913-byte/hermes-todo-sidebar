/**
 * 模块用途：验证 Plan API 稳定错误码映射为安全的 AI 执行失败合同。
 * 模块边界：不暴露连接地址、令牌、SSH 目标或底层响应正文。
 */
import { describe, expect, it } from "vitest";
import { PlanApiError } from "../planApi/planApiErrors.js";
import { toAiExecutionError } from "./aiExecutionError.js";

describe("toAiExecutionError", () => {
  it.each([
    ["version_conflict", "version_conflict"],
    ["validation_failed", "validation_failed"],
    ["offline", "persistence_failed"],
    ["auth_failed", "persistence_failed"],
    ["response_invalid", "persistence_failed"],
    ["http_error", "persistence_failed"]
  ] as const)("maps Plan API %s to %s", (source, expected) => {
    const failure = toAiExecutionError(
      new PlanApiError(source, 500, "request-secret"),
      "validation_failed"
    );

    expect(failure.code).toBe(expected);
    expect(failure.message).not.toContain("request-secret");
    expect(failure.message).not.toContain("http");
  });

  it("does not expose details from an unknown persistence error", () => {
    const failure = toAiExecutionError(
      new Error("ssh://server.example token-secret"),
      "persistence_failed"
    );

    expect(failure).toMatchObject({
      code: "persistence_failed",
      message: "模型操作失败，请重试"
    });
  });
});
