/**
 * 模块用途：验证角色选择器展示已安装角色并标记当前选择。
 * 模块边界：不测试角色发现、图集播放或设置持久化。
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CharacterPack } from "../sidebar/characterPack";
import { createTestCharacterPack } from "../sidebar/testCharacterPack";
import { CharacterPicker } from "./CharacterPicker";

describe("CharacterPicker", () => {
  it("用单选语义展示角色缩略图和名称", () => {
    const html = renderToStaticMarkup(
      <CharacterPicker
        characters={[createPack("penguin-todo", "企鹅待办助手")]}
        selectedId="penguin-todo"
        onChange={() => undefined}
      />
    );

    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain("企鹅待办助手");
    expect(html).toContain("当前使用");
    expect(html).toContain("/penguin.webp");
  });
});

function createPack(id: string, displayName: string): CharacterPack {
  return createTestCharacterPack(id, displayName);
}
