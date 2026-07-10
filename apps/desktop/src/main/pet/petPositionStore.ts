/**
 * 模块用途：保存和校正桌宠入口的位置，为后续拖拽记忆做准备。
 * 模块边界：当前只提供纯函数和内存实现，不直接读写磁盘。
 */
import type { WorkAreaBounds } from "../sidebarBounds.js";

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
