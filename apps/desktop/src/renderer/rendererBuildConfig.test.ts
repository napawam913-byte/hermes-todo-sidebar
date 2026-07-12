/**
 * 模块用途：验证 renderer 生产资源使用相对路径，确保 Electron file:// 可以加载脚本和样式。
 * 模块边界：只检查 Vite 构建配置，不启动浏览器或 Electron。
 */
import { describe, expect, it } from "vitest";
import viteConfig from "../../vite.config";

describe("renderer build config", () => {
  it("uses relative asset paths for packaged Electron", () => {
    expect(viteConfig).toMatchObject({ base: "./" });
  });
});
