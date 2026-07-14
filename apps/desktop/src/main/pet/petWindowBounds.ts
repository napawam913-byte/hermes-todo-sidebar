/**
 * 模块用途：计算桌宠收起窗口和锚定面板的组合窗口几何。
 * 模块边界：只处理屏幕坐标，不访问 Electron screen 或 BrowserWindow。
 */
import {
  DESKTOP_PET_HEIGHT,
  DESKTOP_PET_WIDTH,
  type SidebarWindowBounds,
  type WorkAreaBounds
} from "../sidebarBounds.js";
import type { PetPosition } from "./petPositionStore.js";

export type PetPanelDirection = "up" | "down";

export interface ExpandedPetLayout {
  direction: PetPanelDirection;
  panelHeight: number;
  panelWidth: number;
  windowBounds: SidebarWindowBounds;
  petOffset: PetPosition;
}

export const PET_PANEL_GAP = 8;
export const PET_PANEL_WIDTH_RATIO = 0.5;
export const PET_PANEL_HEIGHT_RATIO = 0.57;
export const PET_PANEL_MIN_WIDTH = 360;
export const PET_PANEL_MAX_WIDTH = 960;
export const PET_PANEL_MIN_HEIGHT = 420;
export const PET_PANEL_MAX_HEIGHT = 720;
export const PET_PANEL_WORK_AREA_MARGIN = 16;

function clamp(value: number, min: number, max: number) {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

export function calculatePetIdleBounds(
  workArea: WorkAreaBounds,
  position?: PetPosition
): SidebarWindowBounds {
  const x = position?.x ?? workArea.x + workArea.width - DESKTOP_PET_WIDTH - 24;
  const y = position?.y ?? workArea.y + workArea.height - DESKTOP_PET_HEIGHT - 24;
  return { x, y, width: DESKTOP_PET_WIDTH, height: DESKTOP_PET_HEIGHT };
}

export function calculateExpandedPanelBounds(
  workArea: WorkAreaBounds,
  petPosition: PetPosition
): ExpandedPetLayout {
  const spaceAbove = petPosition.y - workArea.y - PET_PANEL_GAP;
  const spaceBelow = workArea.y + workArea.height
    - petPosition.y - DESKTOP_PET_HEIGHT - PET_PANEL_GAP;
  const direction: PetPanelDirection = spaceBelow >= spaceAbove ? "down" : "up";
  const availableHeight = direction === "down" ? spaceBelow : spaceAbove;
  const targetHeight = clamp(
    Math.round(workArea.height * PET_PANEL_HEIGHT_RATIO),
    PET_PANEL_MIN_HEIGHT,
    PET_PANEL_MAX_HEIGHT
  );
  const panelHeight = Math.max(0, Math.min(targetHeight, availableHeight));
  const availableWidth = Math.max(0, workArea.width - PET_PANEL_WORK_AREA_MARGIN);
  const targetWidth = clamp(
    Math.round(workArea.width * PET_PANEL_WIDTH_RATIO),
    PET_PANEL_MIN_WIDTH,
    PET_PANEL_MAX_WIDTH
  );
  const panelWidth = Math.min(availableWidth, targetWidth);
  const desiredPanelX = petPosition.x + DESKTOP_PET_WIDTH - panelWidth;
  const panelX = clamp(
    desiredPanelX,
    workArea.x,
    workArea.x + workArea.width - panelWidth
  );
  const panelY = direction === "down"
    ? petPosition.y + DESKTOP_PET_HEIGHT + PET_PANEL_GAP
    : petPosition.y - PET_PANEL_GAP - panelHeight;
  const windowY = Math.min(panelY, petPosition.y);

  return {
    direction,
    panelHeight,
    panelWidth,
    windowBounds: {
      x: panelX,
      y: windowY,
      width: panelWidth,
      height: panelHeight + PET_PANEL_GAP + DESKTOP_PET_HEIGHT
    },
    petOffset: {
      x: petPosition.x - panelX,
      y: petPosition.y - windowY
    }
  };
}
