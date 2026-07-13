/**
 * 模块用途：计算桌宠收起窗口和锚定面板的组合窗口几何。
 * 模块边界：只处理屏幕坐标，不访问 Electron screen 或 BrowserWindow。
 */
import {
  DESKTOP_PET_HEIGHT,
  DESKTOP_PET_WIDTH,
  SIDEBAR_EXPANDED_WIDTH,
  type SidebarWindowBounds,
  type WorkAreaBounds
} from "../sidebarBounds.js";
import type { PetPosition } from "./petPositionStore.js";

export type PetPanelDirection = "up" | "down";

export interface ExpandedPetLayout {
  direction: PetPanelDirection;
  panelHeight: number;
  windowBounds: SidebarWindowBounds;
  petOffset: PetPosition;
}

export const PET_PANEL_GAP = 8;
export const PET_PANEL_TARGET_HEIGHT = 560;

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
  const panelHeight = Math.max(0, Math.min(PET_PANEL_TARGET_HEIGHT, availableHeight));
  const desiredPanelX = petPosition.x + DESKTOP_PET_WIDTH - SIDEBAR_EXPANDED_WIDTH;
  const panelX = clamp(
    desiredPanelX,
    workArea.x,
    workArea.x + workArea.width - SIDEBAR_EXPANDED_WIDTH
  );
  const panelY = direction === "down"
    ? petPosition.y + DESKTOP_PET_HEIGHT + PET_PANEL_GAP
    : petPosition.y - PET_PANEL_GAP - panelHeight;
  const windowY = Math.min(panelY, petPosition.y);

  return {
    direction,
    panelHeight,
    windowBounds: {
      x: panelX,
      y: windowY,
      width: SIDEBAR_EXPANDED_WIDTH,
      height: panelHeight + PET_PANEL_GAP + DESKTOP_PET_HEIGHT
    },
    petOffset: {
      x: petPosition.x - panelX,
      y: petPosition.y - windowY
    }
  };
}
