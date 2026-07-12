/**
 * 模块用途：验证本地日期刷新在午夜后切换到下一天。
 * 模块边界：只测试日期纯函数，不挂载 React 或访问 Electron。
 */
import { describe, expect, it } from "vitest";
import { millisecondsUntilNextLocalDay, toLocalDateKey } from "./useLocalDateKey";

describe("local date key", () => {
  it("formats a local calendar date without time fields", () => {
    expect(toLocalDateKey(new Date(2026, 6, 12, 23, 59, 30))).toBe("2026-07-12");
  });

  it("returns the delay until just after the next local midnight", () => {
    const delay = millisecondsUntilNextLocalDay(new Date(2026, 6, 12, 23, 59, 30));

    expect(delay).toBe(30_050);
  });
});
