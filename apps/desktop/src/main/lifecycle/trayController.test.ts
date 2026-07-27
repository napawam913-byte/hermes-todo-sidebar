/** 模块用途：验证托盘只暴露当前快照导出与应用生命周期命令。 */
import { describe, expect, it, vi } from "vitest";
import { createTrayMenuTemplate } from "./trayController.js";

describe("createTrayMenuTemplate", () => {
  it("does not expose a legacy JSON import command", () => {
    const actions = { show: vi.fn(), hide: vi.fn(), openDataDirectory: vi.fn(), exportData: vi.fn(), quit: vi.fn() };
    const commands = createTrayMenuTemplate(actions).filter((item) => item.type !== "separator");

    expect(commands).toHaveLength(5);
    commands.forEach((item) => item.click?.());
    Object.values(actions).forEach((action) => expect(action).toHaveBeenCalledOnce());
  });
});
