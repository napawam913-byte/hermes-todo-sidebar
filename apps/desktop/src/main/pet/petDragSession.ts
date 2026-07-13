/**
 * 模块用途：记录主进程桌宠 Pointer 会话，并按固定抓取偏移计算窗口位置。
 * 模块边界：不访问 Electron、不约束显示器边界，也不保存位置。
 */
import type {
  PetDragPointerSample,
  PetDragStartSample
} from "../../shared/petDragContract.js";
import type { PetPosition } from "./petPositionStore.js";

export class PetDragSession {
  private state: DragState | undefined;

  start(sample: PetDragStartSample, petPosition: PetPosition): boolean {
    if (this.state) return false;
    this.state = {
      pointerId: sample.pointerId,
      grabOffset: { x: sample.clientX, y: sample.clientY },
      startPosition: { ...petPosition },
      currentPosition: { ...petPosition },
      lastTimeMs: sample.timeMs,
      dragged: false
    };
    return true;
  }

  update(sample: PetDragPointerSample): { position: PetPosition } | undefined {
    const state = this.acceptedState(sample);
    if (!state) return undefined;
    state.lastTimeMs = sample.timeMs;
    state.dragged = true;
    state.currentPosition = calculatePosition(sample, state.grabOffset);
    return { position: { ...state.currentPosition } };
  }

  end(sample: PetDragPointerSample): { dragged: boolean; position: PetPosition } | undefined {
    const state = this.acceptedState(sample);
    if (!state) return undefined;
    if (state.dragged) {
      state.currentPosition = calculatePosition(sample, state.grabOffset);
    }
    const result = {
      dragged: state.dragged,
      position: { ...state.currentPosition }
    };
    this.reset();
    return result;
  }

  cancel(pointerId: number): PetPosition | undefined {
    if (this.state?.pointerId !== pointerId) return undefined;
    const position = { ...this.state.startPosition };
    this.reset();
    return position;
  }

  isActive(): boolean {
    return Boolean(this.state);
  }

  private acceptedState(sample: PetDragPointerSample): DragState | undefined {
    if (
      !this.state
      || this.state.pointerId !== sample.pointerId
      || sample.timeMs < this.state.lastTimeMs
    ) {
      return undefined;
    }
    return this.state;
  }

  private reset(): void {
    this.state = undefined;
  }
}

interface DragState {
  pointerId: number;
  grabOffset: PetPosition;
  startPosition: PetPosition;
  currentPosition: PetPosition;
  lastTimeMs: number;
  dragged: boolean;
}

function calculatePosition(
  sample: PetDragPointerSample,
  grabOffset: PetPosition
): PetPosition {
  return {
    x: sample.screenX - grabOffset.x,
    y: sample.screenY - grabOffset.y
  };
}
