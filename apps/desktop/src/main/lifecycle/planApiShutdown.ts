/** 模块用途：协调 Plan API 退出清理；边界：不持有 Electron 或运行时全局状态。 */
export interface QuitEvent { preventDefault(): void; }
export interface ShutdownRuntime { shutdown(): Promise<void>; }

/** 首次退出等待当前 runtime 清理，最终 quit 只会触发一次。 */
export function createPlanApiBeforeQuitHandler(
  runtime: () => ShutdownRuntime | null,
  quit: () => void,
): (event: QuitEvent) => void {
  let finalQuit = false;
  let stopping: Promise<void> | null = null;
  return (event) => {
    if (finalQuit) return;
    event.preventDefault();
    if (stopping) return;
    stopping = Promise.resolve(runtime()?.shutdown())
      .catch(() => undefined)
      .then(() => { finalQuit = true; quit(); });
  };
}
