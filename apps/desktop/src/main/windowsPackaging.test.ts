/**
 * 模块用途：验证 Windows 打包直接使用仓库内 ICO，避免运行时转换 PNG。
 * 模块边界：只检查打包配置与资源存在性，不启动 electron-builder。
 */
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Windows packaging resources", () => {
  it("uses a checked-in ICO file instead of converting PNG during packaging", () => {
    const packageJson = JSON.parse(
      readFileSync(new URL("../../../../package.json", import.meta.url), "utf8")
    );
    const iconUrl = new URL("../../../../build/icon.ico", import.meta.url);

    expect(packageJson.build.win.icon).toBe("build/icon.ico");
    expect(existsSync(iconUrl)).toBe(true);
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

  it("builds and re-packages current source before making the compatible copy", () => {
    const packageJson = JSON.parse(
      readFileSync(new URL("../../../../package.json", import.meta.url), "utf8")
    );

    expect(packageJson.scripts["dist:win:compatible"]).toBe(
      "npm run build && electron-builder --win --dir && node scripts/create-compatible-portable.mjs"
    );
  });
});
