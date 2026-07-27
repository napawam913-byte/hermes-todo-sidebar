/**
 * 模块用途：验证设置导航中的模型连接状态不会把“已保存”误报成“在线”。
 * 模块边界：只测试纯状态映射，不发起连接测试。
 */
import { describe, expect, it } from "vitest";
import { getSettingsModelStatus } from "./settingsModelStatus";

describe("getSettingsModelStatus", () => {
  it("distinguishes unconfigured, saved, successful and failed states", () => {
    expect(getSettingsModelStatus(false, { status: "idle", message: "" })).toEqual({
      label: "未配置",
      tone: "unconfigured"
    });
    expect(getSettingsModelStatus(true, { status: "idle", message: "" })).toEqual({
      label: "已保存",
      tone: "configured"
    });
    expect(getSettingsModelStatus(true, { status: "success", message: "Hermes 在线" })).toEqual({
      label: "连接正常",
      tone: "success"
    });
    expect(getSettingsModelStatus(true, { status: "failure", message: "连接失败" })).toEqual({
      label: "连接失败",
      tone: "failure"
    });
  });
});
