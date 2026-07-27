/**
 * 模块用途：协调 renderer 的桌宠 Pointer 会话、4px 拖动阈值与安全 IPC bridge。
 * 模块边界：不操作 Electron 窗口，也不保存桌宠屏幕位置。
 */
import type {
  PetDragPointerSample,
  PetDragStartSample
} from "../../../shared/petDragContract";
import {
  createPetDragDirectionTracker,
  updatePetDragDirection,
  type PetDragDirection,
  type PetDragDirectionTracker
} from "./petDragDirection";

export interface PetDragBridge {
  startDrag(sample: PetDragStartSample): void;
  updateDrag(sample: PetDragPointerSample): void;
  endDrag(sample: PetDragPointerSample): void;
  cancelDrag(pointerId: number): void;
}

interface PetDragInteractionOptions {
  bridge: PetDragBridge;
  onDirectionChange?: (direction: PetDragDirection) => void;
  onDraggingChange?: (dragging: boolean) => void;
  onMovingChange?: (moving: boolean) => void;
}

export class PetDragInteraction {
  private startSample: PetDragStartSample | undefined;
  private lastTimeMs = 0;
  private dragging = false;
  private directionTracker: PetDragDirectionTracker | undefined;
  private moving = false;
  private motionPauseTimer: ReturnType<typeof setTimeout> | undefined;
  private suppressNextClick = false;

  constructor(private readonly options: PetDragInteractionOptions) {}

  start(sample: PetDragStartSample): void {
    if (this.startSample) return;
    this.suppressNextClick = false;
    this.startSample = { ...sample };
    this.directionTracker = createPetDragDirectionTracker(sample);
    this.lastTimeMs = sample.timeMs;
    this.dragging = false;
    this.options.bridge.startDrag(sample);
  }

  move(sample: PetDragPointerSample): void {
    if (!this.accepts(sample)) return;
    this.lastTimeMs = sample.timeMs;
    if (!this.dragging && this.crossedThreshold(sample)) {
      this.dragging = true;
      this.options.onDraggingChange?.(true);
    }
    if (this.dragging) {
      this.updateMotion(sample);
      this.options.bridge.updateDrag(sample);
    }
  }

  end(sample: PetDragPointerSample): void {
    if (!this.acceptsPointer(sample.pointerId)) return;
    if (sample.timeMs < this.lastTimeMs) {
      this.cancel(sample.pointerId);
      return;
    }
    this.move(sample);
    const dragged = this.dragging;
    this.options.bridge.endDrag(sample);
    this.reset();
    this.suppressNextClick = dragged;
    if (dragged) this.options.onDraggingChange?.(false);
  }

  cancel(pointerId: number): void {
    if (!this.acceptsPointer(pointerId)) return;
    const dragged = this.dragging;
    this.options.bridge.cancelDrag(pointerId);
    this.reset();
    this.suppressNextClick = false;
    if (dragged) this.options.onDraggingChange?.(false);
  }

  consumeClickSuppression(): boolean {
    const suppressed = this.suppressNextClick;
    this.suppressNextClick = false;
    return suppressed;
  }

  dispose(): void {
    this.clearMotionPause();
  }

  private accepts(sample: PetDragPointerSample): boolean {
    return this.acceptsPointer(sample.pointerId) && sample.timeMs >= this.lastTimeMs;
  }

  private acceptsPointer(pointerId: number): boolean {
    return this.startSample?.pointerId === pointerId;
  }

  private crossedThreshold(sample: PetDragPointerSample): boolean {
    const start = this.startSample;
    if (!start) return false;
    return Math.abs(sample.screenX - start.screenX) >= 4
      || Math.abs(sample.screenY - start.screenY) >= 4;
  }

  private updateMotion(sample: PetDragPointerSample): void {
    const previous = this.directionTracker ?? createPetDragDirectionTracker(sample);
    const next = updatePetDragDirection(previous, sample);
    this.directionTracker = next;
    if (next.direction !== previous.direction) {
      this.options.onDirectionChange?.(next.direction);
    }
    this.setMoving(true);
    this.clearMotionPause();
    this.motionPauseTimer = setTimeout(() => {
      this.motionPauseTimer = undefined;
      this.setMoving(false);
    }, 120);
  }

  private setMoving(moving: boolean): void {
    if (this.moving === moving) return;
    this.moving = moving;
    this.options.onMovingChange?.(moving);
  }

  private clearMotionPause(): void {
    if (this.motionPauseTimer) clearTimeout(this.motionPauseTimer);
    this.motionPauseTimer = undefined;
  }

  private reset(): void {
    this.clearMotionPause();
    this.setMoving(false);
    this.startSample = undefined;
    this.directionTracker = undefined;
    this.lastTimeMs = 0;
    this.dragging = false;
  }
}
