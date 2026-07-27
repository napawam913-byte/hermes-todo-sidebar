/**
 * 模块用途：在 React 中加载、更新并持久化桌宠面板外观偏好。
 * 模块边界：只协调外观设置仓库，不操作面板 DOM 或业务数据。
 */
import { useMemo, useState } from "react";
import {
  createAppearanceSettingsRepository,
  normalizePanelOpacity
} from "./appearanceSettings";

export function useAppearanceSettings() {
  const repository = useMemo(
    () => createAppearanceSettingsRepository(window.localStorage),
    []
  );
  const [settings, setSettings] = useState(() => repository.load());

  function setPanelOpacity(value: number) {
    saveSettings({ ...settings, panelOpacity: normalizePanelOpacity(value) });
  }

  function setCharacterId(characterId: string) {
    saveSettings({ ...settings, characterId });
  }

  function saveSettings(next: typeof settings) {
    setSettings(next);
    try {
      repository.save(next);
    } catch {
      // 本地存储不可用时仍保留当前会话中的外观设置。
    }
  }

  return {
    characterId: settings.characterId,
    panelOpacity: settings.panelOpacity,
    setCharacterId,
    setPanelOpacity
  };
}
