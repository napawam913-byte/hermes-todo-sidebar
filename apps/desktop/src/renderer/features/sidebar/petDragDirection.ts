/**
 * 模块用途：把连续屏幕坐标转换为稳定的桌宠四向行走方向。
 * 模块边界：只处理纯坐标，不持有 Pointer、计时器或 Electron 窗口引用。
 */
export type PetDragDirection = "up" | "down" | "left" | "right";

interface ScreenPoint {
  screenX: number;
  screenY: number;
}

export interface PetDragDirectionTracker {
  anchor: ScreenPoint;
  direction: PetDragDirection;
}

const MIN_DIRECTION_DISTANCE = 3;
const AXIS_SWITCH_RATIO = 1.25;

export function createPetDragDirectionTracker(
  point: ScreenPoint,
  direction: PetDragDirection = "down"
): PetDragDirectionTracker {
  return { anchor: { ...point }, direction };
}

export function updatePetDragDirection(
  tracker: PetDragDirectionTracker,
  point: ScreenPoint
): PetDragDirectionTracker {
  const dx = point.screenX - tracker.anchor.screenX;
  const dy = point.screenY - tracker.anchor.screenY;
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  if (Math.max(absX, absY) < MIN_DIRECTION_DISTANCE) return tracker;

  const horizontal = isHorizontal(tracker.direction);
  let direction = tracker.direction;
  if (horizontal) {
    if (absY >= absX * AXIS_SWITCH_RATIO) direction = dy < 0 ? "up" : "down";
    else if (absX >= MIN_DIRECTION_DISTANCE) direction = dx < 0 ? "left" : "right";
  } else {
    if (absX >= absY * AXIS_SWITCH_RATIO) direction = dx < 0 ? "left" : "right";
    else if (absY >= MIN_DIRECTION_DISTANCE) direction = dy < 0 ? "up" : "down";
  }
  return { anchor: { ...point }, direction };
}

function isHorizontal(direction: PetDragDirection) {
  return direction === "left" || direction === "right";
}
