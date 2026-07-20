/**
 * 模块用途：验证面板不透明度的边界、分层计算和本地持久化合同。
 * 模块边界：只测试纯数据逻辑，不渲染 React 或访问 Electron IPC。
 */
import { describe, expect, it } from "vitest";
import {
  APPEARANCE_STORAGE_KEY,
  DEFAULT_CHARACTER_ID,
  DEFAULT_PANEL_OPACITY,
  MAX_PANEL_OPACITY,
  MIN_PANEL_OPACITY,
  buildSurfaceOpacities,
  createAppearanceSettingsRepository,
  normalizePanelOpacity
} from "./appearanceSettings";

function createMemoryStorage(initial?: string) {
  const values = new Map<string, string>();
  if (initial !== undefined) values.set(APPEARANCE_STORAGE_KEY, initial);
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    readAppearance: () => values.get(APPEARANCE_STORAGE_KEY) ?? null
  };
}

describe("外观设置", () => {
  it("将面板不透明度限制在 72% 到 94%", () => {
    expect(MIN_PANEL_OPACITY).toBe(72);
    expect(MAX_PANEL_OPACITY).toBe(94);
    expect(normalizePanelOpacity(40)).toBe(72);
    expect(normalizePanelOpacity(78.4)).toBe(78);
    expect(normalizePanelOpacity(120)).toBe(94);
    expect(normalizePanelOpacity(Number.NaN)).toBe(DEFAULT_PANEL_OPACITY);
  });

  it("以面板不透明度生成更清晰的卡片和关键操作层", () => {
    expect(buildSurfaceOpacities(78)).toEqual({
      panel: 0.78,
      card: 0.88,
      control: 0.9,
      critical: 0.94,
      cardHover: 0.92
    });
  });

  it("从损坏数据回退并在保存时规范化数值", () => {
    const storage = createMemoryStorage("{broken");
    const repository = createAppearanceSettingsRepository(storage);

    expect(repository.load()).toEqual({
      schemaVersion: 3,
      panelOpacity: 86,
      characterId: DEFAULT_CHARACTER_ID
    });
    repository.save({ schemaVersion: 3, panelOpacity: 120, characterId: "penguin-todo" });
    expect(repository.load()).toEqual({
      schemaVersion: 3,
      panelOpacity: 94,
      characterId: "penguin-todo"
    });
  });

  it("将 v2 的旧默认 78 精确迁移为新默认 86", () => {
    const repository = createAppearanceSettingsRepository(createMemoryStorage(JSON.stringify({
      schemaVersion: 2,
      panelOpacity: 78,
      characterId: "penguin-todo"
    })));

    expect(repository.load()).toEqual({
      schemaVersion: 3,
      panelOpacity: 86,
      characterId: DEFAULT_CHARACTER_ID
    });
  });

  it("读取 v1 透明度并补齐默认角色", () => {
    const repository = createAppearanceSettingsRepository(createMemoryStorage(JSON.stringify({
      schemaVersion: 1,
      panelOpacity: 95
    })));

    expect(repository.load()).toEqual({
      schemaVersion: 3,
      panelOpacity: 94,
      characterId: DEFAULT_CHARACTER_ID
    });
  });

  it.each([
    [60, 72],
    [80, 80],
    [100, 94]
  ])("迁移 v2 自定义透明度 %s 为 %s", (legacyOpacity, expectedOpacity) => {
    const repository = createAppearanceSettingsRepository(createMemoryStorage(JSON.stringify({
      schemaVersion: 2,
      panelOpacity: legacyOpacity,
      characterId: "study-buddy"
    })));

    expect(repository.load()).toEqual({
      schemaVersion: 3,
      panelOpacity: expectedOpacity,
      characterId: "study-buddy"
    });
  });

  it("以 schemaVersion 3 保存并完整回读两个外观字段", () => {
    const storage = createMemoryStorage();
    const repository = createAppearanceSettingsRepository(storage);

    repository.save({ schemaVersion: 3, panelOpacity: 90, characterId: "study-buddy" });

    expect(JSON.parse(storage.readAppearance() ?? "null")).toEqual({
      schemaVersion: 3,
      panelOpacity: 90,
      characterId: "study-buddy"
    });
    expect(repository.load()).toEqual({
      schemaVersion: 3,
      panelOpacity: 90,
      characterId: "study-buddy"
    });
  });
});
