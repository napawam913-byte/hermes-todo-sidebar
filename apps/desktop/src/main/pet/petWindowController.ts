/**
 * 模块用途：编排桌宠窗口的恢复、拖动、展开和收起。
 * 模块边界：通过端口访问屏幕、窗口和位置文件，不导入 Electron。
 */
import type { SidebarWindowBounds } from "../sidebarBounds.js";
import { DESKTOP_PET_HEIGHT, DESKTOP_PET_WIDTH } from "../sidebarBounds.js";
import type {
  PetDragPointerSample,
  PetDragStartSample
} from "../../shared/petDragContract.js";
import { PetDragSession } from "./petDragSession.js";
import {
  clampPetPosition,
  resolvePetPosition,
  type PetDisplayArea,
  type PetPosition,
  type SavedPetPosition
} from "./petPositionStore.js";
import { calculateExpandedPanelBounds, calculatePetIdleBounds } from "./petWindowBounds.js";

export interface PetLayoutSnapshot {
  expanded: boolean;
  direction: "up" | "down";
  panelHeight: number;
  panelWidth: number;
  petOffsetX: number;
  petOffsetY: number;
  dragging: boolean;
}

export interface PetWindowPort {
  setBounds(bounds: SidebarWindowBounds): void;
  sendLayout(snapshot: PetLayoutSnapshot): void;
}

export interface PetScreenPort {
  getDisplays(): PetDisplayArea[];
  getPrimaryDisplayId(): number;
  getDisplayNearestPoint(point: PetPosition): PetDisplayArea;
}

interface PetPositionFilePort {
  load(): Promise<SavedPetPosition | undefined>;
  save(position: SavedPetPosition): Promise<void>;
}

interface PetWindowControllerOptions {
  window: PetWindowPort;
  screen: PetScreenPort;
  positionStore: PetPositionFilePort;
}

export class PetWindowController {
  private readonly dragSession = new PetDragSession();
  private position: PetPosition = { x: 0, y: 0 };
  private displayId = 0;
  private expanded = false;
  private snapshot: PetLayoutSnapshot = createIdleSnapshot(false);

  constructor(private readonly options: PetWindowControllerOptions) {}

  async initialize(): Promise<PetLayoutSnapshot> {
    const saved = await this.options.positionStore.load();
    const resolved = resolvePetPosition(
      saved,
      this.options.screen.getDisplays(),
      this.options.screen.getPrimaryDisplayId()
    );
    this.position = resolved.position;
    this.displayId = resolved.displayId;
    return this.applyIdleBounds(false);
  }

  startDrag(sample: PetDragStartSample): boolean {
    if (this.expanded) return false;
    return this.dragSession.start(sample, this.position);
  }

  updateDrag(sample: PetDragPointerSample): { dragging: boolean } {
    const update = this.dragSession.update(sample);
    if (!update) return { dragging: false };
    const display = this.options.screen.getDisplayNearestPoint(toScreenPoint(sample));
    this.position = clampPetPosition(update.position, display.workArea, petSize, 0);
    this.displayId = display.id;
    this.options.window.setBounds(calculatePetIdleBounds(display.workArea, this.position));
    this.publish(createIdleSnapshot(true));
    return { dragging: true };
  }

  async endDrag(sample: PetDragPointerSample): Promise<{ dragged: boolean }> {
    const result = this.dragSession.end(sample);
    if (!result) return { dragged: false };
    if (!result.dragged) {
      this.publish(createIdleSnapshot(false));
      return { dragged: false };
    }

    const display = this.options.screen.getDisplayNearestPoint(toScreenPoint(sample));
    this.position = clampPetPosition(result.position, display.workArea, petSize, 0);
    this.displayId = display.id;
    this.options.window.setBounds(calculatePetIdleBounds(display.workArea, this.position));
    await this.options.positionStore.save({ displayId: display.id, ...this.position });
    this.publish(createIdleSnapshot(false));
    return { dragged: true };
  }

  cancelDrag(pointerId: number): void {
    const startPosition = this.dragSession.cancel(pointerId);
    if (!startPosition) return;
    this.position = startPosition;
    const display = this.options.screen.getDisplayNearestPoint(this.position);
    this.options.window.setBounds(calculatePetIdleBounds(display.workArea, this.position));
    this.publish(createIdleSnapshot(false));
  }

  isDragActive(): boolean {
    return this.dragSession.isActive();
  }

  setExpanded(expanded: boolean): PetLayoutSnapshot {
    this.expanded = expanded;
    if (!expanded) return this.applyIdleBounds(false);
    const display = this.options.screen.getDisplayNearestPoint(this.position);
    const layout = calculateExpandedPanelBounds(display.workArea, this.position);
    this.options.window.setBounds(layout.windowBounds);
    return this.publish({
      expanded: true,
      direction: layout.direction,
      panelHeight: layout.panelHeight,
      panelWidth: layout.panelWidth,
      petOffsetX: layout.petOffset.x,
      petOffsetY: layout.petOffset.y,
      dragging: false
    });
  }

  getLayout(): PetLayoutSnapshot {
    return { ...this.snapshot };
  }

  async recoverDisplayLayout(): Promise<PetLayoutSnapshot> {
    const resolved = resolvePetPosition(
      { displayId: this.displayId, ...this.position },
      this.options.screen.getDisplays(),
      this.options.screen.getPrimaryDisplayId()
    );
    this.position = resolved.position;
    this.displayId = resolved.displayId;
    const snapshot = this.setExpanded(this.expanded);
    await this.options.positionStore.save({ displayId: this.displayId, ...this.position });
    return snapshot;
  }

  private applyIdleBounds(dragging: boolean): PetLayoutSnapshot {
    const display = this.options.screen.getDisplayNearestPoint(this.position);
    this.options.window.setBounds(calculatePetIdleBounds(display.workArea, this.position));
    return this.publish(createIdleSnapshot(dragging));
  }

  private publish(snapshot: PetLayoutSnapshot): PetLayoutSnapshot {
    this.snapshot = snapshot;
    this.options.window.sendLayout(snapshot);
    return { ...snapshot };
  }
}

const petSize = { width: DESKTOP_PET_WIDTH, height: DESKTOP_PET_HEIGHT };

function createIdleSnapshot(dragging: boolean): PetLayoutSnapshot {
  return {
    expanded: false,
    direction: "down",
    panelHeight: 0,
    panelWidth: 0,
    petOffsetX: 0,
    petOffsetY: 0,
    dragging
  };
}

function toScreenPoint(sample: PetDragPointerSample): PetPosition {
  return { x: sample.screenX, y: sample.screenY };
}
