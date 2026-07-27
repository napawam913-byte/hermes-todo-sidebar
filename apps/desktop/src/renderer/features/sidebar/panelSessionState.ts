/**
 * 模块用途：管理桌宠面板的工作页面、返回目标和瞬时交互重置版本。
 * 模块边界：不保存业务数据，不持久化 AI 会话，也不控制 Electron 窗口。
 */
import type { PanelMode } from "../todos/TopModeTabs";

export type PanelSurface = "today" | "cycle" | "settings" | "ai";
export type SettingsSection = "appearance" | "model" | "data";

export interface PanelSessionState {
  surface: PanelSurface;
  returnSurface: "today" | "cycle";
  settingsSection: SettingsSection;
  interactionResetVersion: number;
}

export type PanelSessionAction =
  | { type: "mode.selected"; mode: PanelMode }
  | { type: "surface.opened"; surface: PanelSurface }
  | { type: "settings.opened" }
  | { type: "settings.closed" }
  | { type: "settings.section-selected"; section: SettingsSection }
  | { type: "panel.collapsed" };

export function createPanelSessionState(): PanelSessionState {
  return {
    surface: "today",
    returnSurface: "today",
    settingsSection: "appearance",
    interactionResetVersion: 0
  };
}

export function reducePanelSessionState(
  state: PanelSessionState,
  action: PanelSessionAction
): PanelSessionState {
  if (action.type === "panel.collapsed") {
    return {
      ...state,
      interactionResetVersion: state.interactionResetVersion + 1
    };
  }
  if (action.type === "mode.selected") {
    return { ...state, surface: action.mode, returnSurface: action.mode };
  }
  if (action.type === "settings.opened") {
    const returnSurface = state.surface === "today" || state.surface === "cycle"
      ? state.surface
      : state.returnSurface;
    return { ...state, surface: "settings", returnSurface };
  }
  if (action.type === "settings.closed") {
    return { ...state, surface: state.returnSurface };
  }
  if (action.type === "settings.section-selected") {
    return { ...state, settingsSection: action.section };
  }
  const returnSurface = action.surface === "today" || action.surface === "cycle"
    ? action.surface
    : action.surface === "ai"
      ? "cycle"
      : state.returnSurface;
  return { ...state, surface: action.surface, returnSurface };
}

export function getPanelMode(state: PanelSessionState): PanelMode {
  if (state.surface === "today") return "today";
  if (state.surface === "cycle" || state.surface === "ai") return "cycle";
  return state.returnSurface;
}
