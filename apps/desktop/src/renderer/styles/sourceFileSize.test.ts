/**
 * 模块用途：防止前端和 Electron 源码重新膨胀成难以维护的超大文件。
 * 模块边界：只检查 TS、TSX、CSS 行数，不检查生成产物和文档。
 */
import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourceRoot = fileURLToPath(new URL("../../", import.meta.url));
const allowedExtensions = new Set([".ts", ".tsx", ".css"]);

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(path);
    return allowedExtensions.has(extname(entry.name)) ? [path] : [];
  });
}

describe("源码文件体积约束", () => {
  it("每个 TS、TSX、CSS 文件不超过 220 行", () => {
    const oversized = collectSourceFiles(sourceRoot)
      .map((path) => ({
        file: relative(sourceRoot, path).replaceAll("\\", "/"),
        lines: readFileSync(path, "utf8").trimEnd().split(/\r?\n/).length
      }))
      .filter(({ lines }) => lines > 220);

    expect(oversized).toEqual([]);
  });
});
