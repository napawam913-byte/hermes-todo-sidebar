/**
 * 模块用途：定义 renderer、preload 与主进程共用的桌宠 Pointer 坐标协议。
 * 模块边界：只描述和校验可序列化数据，不依赖 React 或 Electron。
 */
export interface PetDragPointerSample {
  pointerId: number;
  screenX: number;
  screenY: number;
  timeMs: number;
}

export interface PetDragStartSample extends PetDragPointerSample {
  clientX: number;
  clientY: number;
}

export function isPetPointerId(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

export function isPetDragPointerSample(value: unknown): value is PetDragPointerSample {
  if (!isRecord(value)) return false;
  return isPetPointerId(value.pointerId)
    && isFiniteNumber(value.screenX)
    && isFiniteNumber(value.screenY)
    && isNonNegativeFiniteNumber(value.timeMs);
}

export function isPetDragStartSample(value: unknown): value is PetDragStartSample {
  if (!isRecord(value)) return false;
  const record: Record<string, unknown> = value;
  if (!isPetDragPointerSample(record)) return false;
  return isFiniteNumber(record.clientX) && isFiniteNumber(record.clientY);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0;
}
