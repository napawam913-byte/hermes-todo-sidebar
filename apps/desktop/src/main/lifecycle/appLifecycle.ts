/**
 * 模块用途：集中定义单实例锁和正式包开机启动策略。
 * 模块边界：只调用最小应用生命周期接口，不创建窗口或托盘。
 */
interface SingleInstanceApp {
  requestSingleInstanceLock(): boolean;
  quit(): void;
}

interface LoginStartupApp {
  isPackaged: boolean;
  setLoginItemSettings(settings: { openAtLogin: boolean }): void;
}

interface LaunchAtLoginOptions {
  portable?: boolean;
}

export function ensureSingleInstance(app: SingleInstanceApp): boolean {
  const acquired = app.requestSingleInstanceLock();
  if (!acquired) app.quit();
  return acquired;
}

export function configureLaunchAtLogin(
  app: LoginStartupApp,
  options: LaunchAtLoginOptions = {}
): void {
  if (!app.isPackaged || options.portable) return;
  app.setLoginItemSettings({ openAtLogin: true });
}
