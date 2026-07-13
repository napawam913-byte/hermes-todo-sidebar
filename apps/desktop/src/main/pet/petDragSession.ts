/**
 * 模块用途：区分桌宠点击与拖动，并记录一次指针会话的坐标。
 * 模块边界：不访问 Electron、不约束显示器边界，也不保存位置。
 */
import type { PetPosition } from "./petPositionStore.js";

export class PetDragSession {
  private startCursor: PetPosition | null = null;
  private startPosition: PetPosition | null = null;
  private currentPosition: PetPosition | null = null;
  private dragging = false;

  constructor(private readonly threshold: number) {}

  start(cursor: PetPosition, petPosition: PetPosition): void {
    this.startCursor = { ...cursor };
    this.startPosition = { ...petPosition };
    this.currentPosition = { ...petPosition };
    this.dragging = false;
  }

  update(cursor: PetPosition): { dragging: boolean; position?: PetPosition } {
    const startCursor = this.requirePosition(this.startCursor);
    const startPosition = this.requirePosition(this.startPosition);
    const deltaX = cursor.x - startCursor.x;
    const deltaY = cursor.y - startCursor.y;
    if (!this.dragging && Math.hypot(deltaX, deltaY) > this.threshold) {
      this.dragging = true;
    }
    if (!this.dragging) return { dragging: false };

    this.currentPosition = {
      x: startPosition.x + deltaX,
      y: startPosition.y + deltaY
    };
    return { dragging: true, position: { ...this.currentPosition } };
  }

  end(): { dragged: boolean; position: PetPosition } {
    const result = {
      dragged: this.dragging,
      position: { ...this.requirePosition(this.currentPosition) }
    };
    this.reset();
    return result;
  }

  cancel(): PetPosition {
    const position = { ...this.requirePosition(this.startPosition) };
    this.reset();
    return position;
  }

  private requirePosition(position: PetPosition | null): PetPosition {
    if (!position) throw new Error("桌宠拖动会话尚未开始");
    return position;
  }

  private reset() {
    this.startCursor = null;
    this.startPosition = null;
    this.currentPosition = null;
    this.dragging = false;
  }
}
