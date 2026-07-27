/**
 * 模块用途：锁定 C 分栏设置控制台的 720px 响应式布局合同。
 * 模块边界：只读取 CSS 源码，不执行浏览器布局。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("设置控制台布局", () => {
  it("uses three stable compact tabs by default and a 156px sidebar from 720px", () => {
    const css = read("./settings-shell.css");

    expect(css).toContain(".settings-compact-tabs");
    expect(css).toContain("@container settings (min-width: 720px)");
    expect(css).toContain("grid-template-columns: 156px minmax(0, 1fr)");
    expect(css).toContain("overflow-x: hidden");
    expect(css).toContain("repeat(3, minmax(0, 1fr))");
  });

  it("keeps the data service form constrained at narrow widths", () => {
    const css = read("./data-service-settings.css");

    expect(css).toContain(".data-service-form");
    expect(css).toContain("min-width: 0");
    expect(css).toContain("repeat(3, minmax(0, 1fr))");
  });

  it("keeps appearance groups unframed while character options remain selectable tiles", () => {
    const css = read("./appearance-settings.css");

    expect(css).not.toContain(".appearance-settings-card");
    expect(css).toContain(".settings-section-divider");
    expect(css).toContain(".character-option.is-selected");
    expect(css).toContain("repeat(2, minmax(0, 1fr))");
    expect(css).toContain("justify-items: center");
    expect(css).toContain(".character-option:focus-visible");
  });
});
