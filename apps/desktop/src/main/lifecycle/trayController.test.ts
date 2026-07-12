/**
 * 模块用途：验证托盘菜单中文命令完整，并准确转发到桌面动作。
 * 模块边界：只测试纯菜单模板，不创建真实 Windows 托盘图标。
 */
import { describe, expect, it, vi } from "vitest";
import { createTrayMenuTemplate } from "./trayController.js";

describe("createTrayMenuTemplate", () => {
  it("exposes the official local data and lifecycle commands", () => {
    const actions = {
      show: vi.fn(),
      hide: vi.fn(),
      openDataDirectory: vi.fn(),
      exportData: vi.fn(),
      importData: vi.fn(),
      quit: vi.fn()
    };

    const menu = createTrayMenuTemplate(actions);
    const commandItems = menu.filter((item) => item.type !== "separator");

    expect(commandItems.map((item) => item.label)).toEqual([
      "打开待办",
      "隐藏",
      "打开数据目录",
      "导出数据",
      "导入数据",
      "退出"
    ]);
    commandItems.forEach((item) => item.click?.());
    Object.values(actions).forEach((action) => expect(action).toHaveBeenCalledOnce());
  });
});
