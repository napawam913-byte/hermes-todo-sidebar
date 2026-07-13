/**
 * 模块用途：验证测试便携版使用独立 userData 目录。
 * 模块边界：只检查环境变量与路径，不调用 Electron app。
 */
import { describe, expect, it } from "vitest";
import { getRuntimeChannel, getTestUserDataPath } from "./runtimeChannel.js";

describe("runtimeChannel", () => {
  it("从测试便携版文件名识别 test 通道", () => {
    expect(getRuntimeChannel({
      PORTABLE_EXECUTABLE_FILE: "D:\\release\\Hermes-0.1.2-test.1-portable.exe"
    })).toBe("test");
  });

  it("正式便携版保持 stable 通道", () => {
    expect(getRuntimeChannel({
      PORTABLE_EXECUTABLE_FILE: "D:\\release\\Hermes-0.1.2-portable.exe"
    })).toBe("stable");
  });

  it("从免安装目录版可执行文件路径识别 test 通道", () => {
    expect(getRuntimeChannel(
      {},
      "D:\\release\\Hermes 待办桌宠-0.1.2-test.4-免安装目录版\\启动.exe"
    )).toBe("test");
  });

  it("测试通道固定写入独立的 APPDATA 子目录", () => {
    expect(getTestUserDataPath("C:\\Users\\me\\AppData\\Roaming"))
      .toBe("C:\\Users\\me\\AppData\\Roaming\\hermes-todo-sidebar-test");
  });
});
