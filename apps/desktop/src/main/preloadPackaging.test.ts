/**
 * 模块用途：验证 Electron preload 以 CommonJS 文件打包，避免 sandbox 无法执行 ESM import。
 * 模块边界：只检查源码扩展名和主进程加载路径，不启动 Electron。
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const mainDirectory = path.dirname(fileURLToPath(import.meta.url));
const sourceDirectory = path.resolve(mainDirectory, "..");

describe("preload packaging", () => {
  it("uses a .cts source and loads the emitted .cjs file", () => {
    expect(existsSync(path.join(sourceDirectory, "preload", "preload.cts"))).toBe(true);
    const mainSource = readFileSync(path.join(mainDirectory, "main.ts"), "utf8");
    expect(mainSource).toContain('../preload/preload.cjs');
  });
});
