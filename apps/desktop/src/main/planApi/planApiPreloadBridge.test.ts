/**
 * 模块用途：验证 preload 暴露只读迁移预览通道。
 * 模块边界：只检查桥接源码，不启动 Electron。
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const mainDirectory = path.dirname(fileURLToPath(import.meta.url));
const preloadPath = path.resolve(
  mainDirectory,
  "../../preload/preload.cts",
);

describe("Plan API preload bridge", () => {
  it("exposes the read-only migration inspection IPC", () => {
    const source = readFileSync(preloadPath, "utf8");

    expect(source).toMatch(
      /inspectMigration:[\s\S]{0,100}ipcRenderer\.invoke\("plan-api:inspect-migration"\)/,
    );
  });
});
