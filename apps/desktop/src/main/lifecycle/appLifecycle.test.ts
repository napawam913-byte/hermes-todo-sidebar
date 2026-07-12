/**
 * 模块用途：验证单实例和开机启动策略只在正确的 Windows 应用状态下生效。
 * 模块边界：使用应用接口替身，不启动 Electron。
 */
import { describe, expect, it, vi } from "vitest";
import { configureLaunchAtLogin, ensureSingleInstance } from "./appLifecycle.js";

describe("appLifecycle", () => {
  it("quits when another application instance already owns the lock", () => {
    const app = {
      requestSingleInstanceLock: vi.fn(() => false),
      quit: vi.fn()
    };

    expect(ensureSingleInstance(app)).toBe(false);
    expect(app.quit).toHaveBeenCalledOnce();
  });

  it("enables login startup only for the packaged application", () => {
    const packaged = { isPackaged: true, setLoginItemSettings: vi.fn() };
    const development = { isPackaged: false, setLoginItemSettings: vi.fn() };

    configureLaunchAtLogin(packaged);
    configureLaunchAtLogin(development);

    expect(packaged.setLoginItemSettings).toHaveBeenCalledWith({ openAtLogin: true });
    expect(development.setLoginItemSettings).not.toHaveBeenCalled();
  });
});
