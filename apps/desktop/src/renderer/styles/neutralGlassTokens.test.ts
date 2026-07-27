/**
 * 模块用途：锁定 Neutral Glass 颜色、材质和角色主题解耦合同。
 * 模块边界：只读取源码文本，不渲染组件或执行浏览器样式计算。
 */
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

const tokenFiles = new Set(["tokens.css", "neutral-glass-tokens.css"]);
const neutralGlassBusinessStyles = [
  ...read("./global.css").matchAll(/@import "\.\/([^\"]+\.css)"/g)
].map((match) => match[1]).filter((name) => !tokenFiles.has(name));
const directTokenStyles = [
  "sidebar.css",
  "appearance-settings.css",
  "todo-detail.css",
  "detail-page.css",
  "todo-state.css",
  "cycle-plan.css",
  "cycle-drawer.css",
  "ai-planner.css",
  "ai-flow-nav.css",
  "ai-conversation.css",
  "ai-composer.css",
  "ai-proposal.css",
  "ai-execution.css",
  "manual-mutation.css",
  "status-menu.css"
] as const;

describe("Neutral Glass 静态合同", () => {
  it("定义固定冷白面板、Apple 蓝和玻璃次级文字", () => {
    const tokens = read("./neutral-glass-tokens.css").toLowerCase();

    expect(tokens).toContain("--ui-panel-rgb: 246 247 249");
    expect(tokens).toContain("--ui-accent: #007aff");
    expect(tokens).toContain("--ui-text-on-glass-secondary: #3a3a3c");
    expect(tokens).toContain("--ui-text-caption: #54545a");
    expect(tokens).toContain("--ui-danger-text: #b42318");
    expect(tokens).toContain("--ui-warning-text: #7a4300");
    expect(tokens).toContain("--ui-success-text: #17652f");
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

  it("每个被引用的 ui Token 都有全局定义", () => {
    const tokenSource = read("./neutral-glass-tokens.css");
    const declared = new Set(
      [...tokenSource.matchAll(/(--ui-[a-z0-9-]+)\s*:/gi)].map((match) => match[1])
    );
    const referenced = readdirSync(new URL(".", import.meta.url))
      .filter((name) => name.endsWith(".css"))
      .flatMap((name) => [...read(`./${name}`).matchAll(/var\((--ui-[a-z0-9-]+)/gi)])
      .map((match) => match[1]);

    expect([...new Set(referenced.filter((name) => !declared.has(name)))]).toEqual([]);
  });

  it("全部生产样式不携带旧配色或角色耦合", () => {
    const legacyToken = /var\(--(?:surface|ink|border|accent|danger|warning|success)[a-z-]*/i;
    const hardCodedHex = /#[0-9a-f]{3,8}\b/i;
    const characterCoupling = /(?:--character-|\[data-character-id|#penguin-todo\b)/i;

    for (const file of neutralGlassBusinessStyles) {
      const source = read(`./${file}`);

      expect(source, `${file} should not use oklch`).not.toContain("oklch(");
      expect(source, `${file} should not hard code colors`).not.toMatch(hardCodedHex);
      expect(source, `${file} should not couple UI to a character`).not.toMatch(characterCoupling);
    }

    for (const file of directTokenStyles) {
      expect(read(`./${file}`), `${file} should not use legacy tokens`).not.toMatch(legacyToken);
    }
  });

  it("小字号状态文案使用高对比语义前景色", () => {
    const conversation = read("./ai-conversation.css");
    const proposal = read("./ai-proposal.css");

    expect(conversation).toContain("var(--ui-success-text)");
    expect(conversation).toContain("var(--ui-warning-text)");
    expect(`${conversation}\n${proposal}`).toContain("var(--ui-text-caption)");
    expect(proposal).toContain("var(--ui-danger-text)");
  });

  it("详情切页使用统一的 180ms 动效", () => {
    const detailPage = read("./detail-page.css");

    expect(detailPage).toContain("detail-page-in 180ms");
  });
});
