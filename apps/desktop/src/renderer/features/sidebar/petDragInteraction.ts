/**
 * 模块用途：协调 renderer 的桌宠指针会话与安全 IPC bridge。
 * 模块边界：不读取坐标、不判断 5px 阈值，也不操作 React 状态树。
 */
export interface PetDragBridge {
  startDrag(): Promise<boolean>;
  updateDrag(): Promise<{ dragging: boolean }>;
  endDrag(): Promise<{ dragged: boolean }>;
  cancelDrag(): Promise<void>;
}

interface PetDragInteractionOptions {
  bridge: PetDragBridge;
  onActivate: () => void;
  onDraggingChange?: (dragging: boolean) => void;
}

export class PetDragInteraction {
  private pressed = false;

  constructor(private readonly options: PetDragInteractionOptions) {}

  async start(): Promise<void> {
    this.pressed = await this.options.bridge.startDrag();
  }

  async move(): Promise<void> {
    if (!this.pressed) return;
    const result = await this.options.bridge.updateDrag();
    this.options.onDraggingChange?.(result.dragging);
  }

  async end(): Promise<void> {
    if (!this.pressed) return;
    const result = await this.options.bridge.endDrag();
    this.pressed = false;
    this.options.onDraggingChange?.(false);
    if (!result.dragged) this.options.onActivate();
  }

  async cancel(): Promise<void> {
    if (!this.pressed) return;
    this.pressed = false;
    await this.options.bridge.cancelDrag();
    this.options.onDraggingChange?.(false);
  }
}
