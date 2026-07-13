/**
 * 模块用途：保存和校正桌宠入口的位置，为后续拖拽记忆做准备。
 * 模块边界：当前只提供纯函数和内存实现，不直接读写磁盘。
 */
import {
  DESKTOP_PET_HEIGHT,
  DESKTOP_PET_WIDTH,
  type WorkAreaBounds
} from "../sidebarBounds.js";

export interface PetPosition {
  x: number;
  y: number;
}

export interface PetWindowSize {
  width: number;
  height: number;
}

export interface PetPositionStore {
  load(): PetPosition | undefined;
  save(position: PetPosition): void;
  clear(): void;
}

export interface PetDisplayArea {
  id: number;
  workArea: WorkAreaBounds;
}

export interface SavedPetPosition extends PetPosition {
  displayId: number;
}

export interface ResolvedPetPosition {
  displayId: number;
  position: PetPosition;
}

function clamp(value: number, min: number, max: number) {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

export function clampPetPosition(
  position: PetPosition,
  workArea: WorkAreaBounds,
  size: PetWindowSize,
  margin = 8
): PetPosition {
  const minX = workArea.x + margin;
  const minY = workArea.y + margin;
  const maxX = workArea.x + workArea.width - size.width - margin;
  const maxY = workArea.y + workArea.height - size.height - margin;

  return {
    x: clamp(position.x, minX, maxX),
    y: clamp(position.y, minY, maxY)
  };
}

export function createMemoryPetPositionStore(initialPosition?: PetPosition): PetPositionStore {
  let lastPosition = initialPosition;

  return {
    load() {
      return lastPosition ? { ...lastPosition } : undefined;
    },
    save(position) {
      lastPosition = { ...position };
    },
    clear() {
      lastPosition = undefined;
    }
  };
}

export function resolvePetPosition(
  saved: SavedPetPosition | undefined,
  displays: PetDisplayArea[],
  primaryDisplayId: number
): ResolvedPetPosition {
  const primary = displays.find((display) => display.id === primaryDisplayId) ?? displays[0];
  if (!primary) throw new Error("没有可用的显示器工作区");

  const savedDisplay = saved
    ? displays.find((display) => display.id === saved.displayId)
    : undefined;
  if (saved && savedDisplay) {
    return {
      displayId: savedDisplay.id,
      position: clampPetPosition(saved, savedDisplay.workArea, {
        width: DESKTOP_PET_WIDTH,
        height: DESKTOP_PET_HEIGHT
      })
    };
  }

  return {
    displayId: primary.id,
    position: {
      x: primary.workArea.x + primary.workArea.width - DESKTOP_PET_WIDTH - 24,
      y: primary.workArea.y + primary.workArea.height - DESKTOP_PET_HEIGHT - 24
    }
  };
}
