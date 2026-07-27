/**
 * 模块用途：顺序执行主进程启动阶段，并把失败收敛为固定、安全的退出路径。
 * 模块边界：不记录或展示底层异常，不直接依赖 Electron、窗口或 Plan API。
 */
export const BOOTSTRAP_FAILURE_TITLE = "Hermes 待办桌宠启动失败";
export const BOOTSTRAP_FAILURE_MESSAGE =
  "数据服务或智能助手初始化失败，应用将退出。请检查配置后重试。";

export interface BootstrapSequence<T> {
  initializePlanApi(): Promise<T>;
  registerAi(runtime: T): void;
  createDesktop(runtime: T): Promise<void>;
}

export interface BootstrapFailureHandler {
  showError(title: string, message: string): void;
  exit(code: number): void;
}

/** 仅上报固定文案，确保任意启动异常都不会泄露连接或请求细节。 */
export function reportBootstrapFailure(failure: BootstrapFailureHandler): void {
  try {
    failure.showError(BOOTSTRAP_FAILURE_TITLE, BOOTSTRAP_FAILURE_MESSAGE);
  } catch {
    // 错误框本身失败时仍必须走确定退出，不传播原始启动异常。
  }
  failure.exit(1);
}

export async function runBootstrapSequence<T>(
  sequence: BootstrapSequence<T>,
  failure: BootstrapFailureHandler
): Promise<void> {
  try {
    const runtime = await sequence.initializePlanApi();
    sequence.registerAi(runtime);
    await sequence.createDesktop(runtime);
  } catch {
    reportBootstrapFailure(failure);
  }
}
