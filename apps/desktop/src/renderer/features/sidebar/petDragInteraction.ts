/**
 * 模块用途：协调 renderer 的桌宠 Pointer 会话、4px 拖动阈值与安全 IPC bridge。
 * 模块边界：不操作 Electron 窗口，也不保存桌宠屏幕位置。
 */
import type {
  PetDragPointerSample,
  PetDragStartSample
} from "../../../shared/petDragContract";

export interface PetDragBridge {
  startDrag(sample: PetDragStartSample): void;
  updateDrag(sample: PetDragPointerSample): void;
  endDrag(sample: PetDragPointerSample): void;
  cancelDrag(pointerId: number): void;
}

interface PetDragInteractionOptions {
  bridge: PetDragBridge;
  onActivate: () => void;
  onDraggingChange?: (dragging: boolean) => void;
}

export class PetDragInteraction {
  private startSample: PetDragStartSample | undefined;
  private lastTimeMs = 0;
  private dragging = false;
  private onActivate: () => void;

  constructor(private readonly options: PetDragInteractionOptions) {
    this.onActivate = options.onActivate;
  }

  setOnActivate(callback: () => void): void {
    this.onActivate = callback;
  }

  start(sample: PetDragStartSample): void {
    if (this.startSample) return;
    this.startSample = { ...sample };
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
    if (this.dragging) this.options.bridge.updateDrag(sample);
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
    if (dragged) this.options.onDraggingChange?.(false);
    else this.onActivate();
  }

  cancel(pointerId: number): void {
    if (!this.acceptsPointer(pointerId)) return;
    const dragged = this.dragging;
    this.options.bridge.cancelDrag(pointerId);
    this.reset();
    if (dragged) this.options.onDraggingChange?.(false);
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

  private reset(): void {
    this.startSample = undefined;
    this.lastTimeMs = 0;
    this.dragging = false;
  }
}
