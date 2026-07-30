/**
 * 模块用途：阻止本机运行时凭据和 Python 安装产物进入 Git。
 * 模块边界：只检查仓库忽略规则，不读取任何凭据内容。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ignoreRules = readFileSync(
  new URL("../../../../.gitignore", import.meta.url),
  "utf8"
).split(/\r?\n/);

describe("repository hygiene", () => {
  it("ignores runtime data and Python package metadata", () => {
    expect(ignoreRules).toContain("/data/");
    expect(ignoreRules).toContain("*.egg-info/");
  });
});
