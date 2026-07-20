/**
 * 模块用途：锁定 Neutral Glass 颜色、材质和角色主题解耦合同。
 * 模块边界：只读取源码文本，不渲染组件或执行浏览器样式计算。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("Neutral Glass 静态合同", () => {
  it("定义固定冷白面板、Apple 蓝和玻璃次级文字", () => {
    const tokens = read("./neutral-glass-tokens.css").toLowerCase();

    expect(tokens).toContain("--ui-panel-rgb: 246 247 249");
    expect(tokens).toContain("--ui-accent: #007aff");
    expect(tokens).toContain("--ui-text-on-glass-secondary: #3a3a3c");
  });

  it("面板只使用固定中性材质和用户透明度", () => {
    const popover = read("./anchored-popover.css").toLowerCase();

    expect(popover).toContain("rgb(var(--ui-panel-rgb) / var(--panel-opacity))");
    expect(popover).toContain("blur(28px) saturate(1.08)");
    expect(popover).toContain("rgb(var(--ui-panel-rgb) / 0.96)");
    expect(popover).toContain("backdrop-filter: none");
    expect(popover).not.toContain("--character-surface-tint");
  });

  it("SidebarShell 不再从角色包注入界面颜色", () => {
    const shell = read("../features/sidebar/SidebarShell.tsx");

    expect(shell).not.toContain("manifest.theme");
    expect(shell).not.toContain("--character-surface-tint");
    expect(shell).not.toContain('"--accent"');
  });

  it("全局样式在组件之前加载中性 Token", () => {
    const globalCss = read("./global.css");
    const tokenIndex = globalCss.indexOf('@import "./neutral-glass-tokens.css"');
    const buttonIndex = globalCss.indexOf('@import "./buttons.css"');

    expect(tokenIndex).toBeGreaterThan(-1);
    expect(tokenIndex).toBeLessThan(buttonIndex);
  });
});
