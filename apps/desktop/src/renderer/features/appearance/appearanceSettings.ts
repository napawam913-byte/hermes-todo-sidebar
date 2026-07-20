/**
 * 模块用途：定义桌宠面板外观偏好、透明层级计算和浏览器本地存储适配。
 * 模块边界：不渲染 UI，也不访问 Electron 主进程或待办数据。
 */
export const APPEARANCE_STORAGE_KEY = "hermes.appearance.v1";
export const DEFAULT_CHARACTER_ID = "penguin-todo";
export const DEFAULT_PANEL_OPACITY = 86;
export const MIN_PANEL_OPACITY = 72;
export const MAX_PANEL_OPACITY = 94;

const LEGACY_V2_DEFAULT_PANEL_OPACITY = 78;

export interface AppearanceSettings {
  schemaVersion: 3;
  panelOpacity: number;
  characterId: string;
}

interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface AppearanceSettingsRepository {
  load(): AppearanceSettings;
  save(settings: AppearanceSettings): void;
}

export function normalizePanelOpacity(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_PANEL_OPACITY;
  return Math.min(MAX_PANEL_OPACITY, Math.max(MIN_PANEL_OPACITY, Math.round(value)));
}

export function buildSurfaceOpacities(panelOpacity: number) {
  const panel = normalizePanelOpacity(panelOpacity) / 100;
  const card = Math.min(0.96, panel + 0.1);
  const control = Math.min(0.96, panel + 0.12);
  return {
    panel,
    card,
    control,
    critical: Math.max(0.94, card),
    cardHover: Math.min(1, card + 0.04)
  };
}

export function createAppearanceSettingsRepository(
  storage: KeyValueStorage
): AppearanceSettingsRepository {
  return {
    load() {
      try {
        const parsed = JSON.parse(storage.getItem(APPEARANCE_STORAGE_KEY) ?? "null");
        if (parsed?.schemaVersion === 1) {
          return {
            schemaVersion: 3,
            panelOpacity: normalizePanelOpacity(parsed.panelOpacity),
            characterId: DEFAULT_CHARACTER_ID
          };
        }
        if (parsed?.schemaVersion === 2) {
          return {
            schemaVersion: 3,
            panelOpacity: parsed.panelOpacity === LEGACY_V2_DEFAULT_PANEL_OPACITY
              ? DEFAULT_PANEL_OPACITY
              : normalizePanelOpacity(parsed.panelOpacity),
            characterId: normalizeCharacterId(parsed.characterId)
          };
        }
        if (parsed?.schemaVersion !== 3) return createDefaultSettings();
        return {
          schemaVersion: 3,
          panelOpacity: normalizePanelOpacity(parsed.panelOpacity),
          characterId: normalizeCharacterId(parsed.characterId)
        };
      } catch {
        return createDefaultSettings();
      }
    },
    save(settings) {
      const normalized: AppearanceSettings = {
        schemaVersion: 3,
        panelOpacity: normalizePanelOpacity(settings.panelOpacity),
        characterId: normalizeCharacterId(settings.characterId)
      };
      storage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(normalized));
    }
  };
}

export function createDefaultSettings(): AppearanceSettings {
  return {
    schemaVersion: 3,
    panelOpacity: DEFAULT_PANEL_OPACITY,
    characterId: DEFAULT_CHARACTER_ID
  };
}

function normalizeCharacterId(value: unknown) {
  return typeof value === "string" && /^[a-z0-9][a-z0-9-]*$/.test(value)
    ? value
    : DEFAULT_CHARACTER_ID;
}
