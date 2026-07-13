/**
 * 模块用途：识别稳定版与测试便携版的数据运行通道。
 * 模块边界：不调用 Electron app，也不创建或复制数据文件。
 */
export type RuntimeChannel = "stable" | "test";

import path from "node:path";

export function getRuntimeChannel(
  environment: NodeJS.ProcessEnv,
  executablePath = ""
): RuntimeChannel {
  if (environment.HERMES_RUNTIME_CHANNEL?.toLowerCase() === "test") return "test";
  const portableFile = environment.PORTABLE_EXECUTABLE_FILE?.toLowerCase() ?? "";
  const executableFile = executablePath.toLowerCase();
  return [portableFile, executableFile].some((value) => value.includes("-test."))
    ? "test"
    : "stable";
}

export function getTestUserDataPath(appDataPath: string): string {
  return path.join(appDataPath, "hermes-todo-sidebar-test");
}
