/**
 * 模块用途：验证 Windows 打包直接使用仓库内 ICO，避免运行时转换 PNG。
 * 模块边界：只检查打包配置与资源存在性，不启动 electron-builder。
 */
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("Windows packaging resources", () => {
  it("uses a checked-in ICO file instead of converting PNG during packaging", () => {
    const packageJson = JSON.parse(
      readFileSync(new URL("../../../../package.json", import.meta.url), "utf8")
    );
    const iconUrl = new URL("../../../../build/icon.ico", import.meta.url);

    expect(packageJson.build.win.icon).toBe("build/icon.ico");
    expect(existsSync(iconUrl)).toBe(true);
    expect([...readFileSync(iconUrl).subarray(0, 4)]).toEqual([0, 0, 1, 0]);
  });

  it("provides a policy-compatible unpacked test package command", () => {
    const packageJson = JSON.parse(
      readFileSync(new URL("../../../../package.json", import.meta.url), "utf8")
    );
    const scriptUrl = new URL(
      "../../../../scripts/create-compatible-portable.mjs",
      import.meta.url
    );

    expect(packageJson.scripts["dist:win:compatible"]).toContain(
      "node scripts/create-compatible-portable.mjs"
    );
    expect(existsSync(scriptUrl)).toBe(true);
  });

  it("builds an x64 unpacked package before making the compatible copy", () => {
    const packageJson = JSON.parse(
      readFileSync(new URL("../../../../package.json", import.meta.url), "utf8")
    );

    expect(packageJson.scripts["dist:win:compatible"]).toBe(
      "npm run build && electron-builder --win --x64 --dir && node scripts/create-compatible-portable.mjs"
    );
  });

  it("renames the builder executable and exports the strict release path guard", () => {
    const script = readFileSync(
      new URL("../../../../scripts/create-compatible-portable.mjs", import.meta.url),
      "utf8"
    );

    expect(script).toContain("renameSync(sourceExecutable, targetExecutable)");
    expect(script).not.toContain("electron.exe");
    expect(script).toContain("export function assertInsideRelease");
  });

  it("rejects cleanup paths outside release through the exported path guard", () => {
    const scriptUrl = new URL(
      "../../../../scripts/create-compatible-portable.mjs",
      import.meta.url
    ).href;
    const program = [
      `import { assertInsideRelease } from ${JSON.stringify(scriptUrl)};`,
      'assertInsideRelease("C:\\\\outside");'
    ].join("\n");

    const result = spawnSync(
      process.execPath,
      ["--input-type=module", "--eval", program],
      { encoding: "utf8" }
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("拒绝清理 release 之外的目录");
  });
});
