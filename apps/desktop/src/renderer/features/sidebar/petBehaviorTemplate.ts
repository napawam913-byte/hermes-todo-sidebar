/**
 * 模块用途：集中定义所有角色共享的动作节奏、优先级与动作槽位。
 * 模块边界：不持有运行时状态，不创建计时器，也不读取角色图片。
 */
import type { PetDragDirection } from "./petDragDirection";
import type { PetVisualState } from "./petVisualState";

export type PetPlaybackMode = "loop" | "once" | "once-hold";

export interface PetBehaviorClip {
  row: number;
  durationMs: number;
  mode: PetPlaybackMode;
  reducedMotionFrame: number;
}

interface PetBehaviorTemplate {
  idleBase: PetBehaviorClip;
  idleBlink: PetBehaviorClip;
  awaken: PetBehaviorClip;
  dragging: Omit<PetBehaviorClip, "row">;
  thinking: PetBehaviorClip;
  working: PetBehaviorClip;
  waiting: PetBehaviorClip;
  reminding: PetBehaviorClip;
  complete: PetBehaviorClip;
  error: PetBehaviorClip;
  sleeping: PetBehaviorClip;
}

export type PetClipSlot =
  | "idle.base" | "idle.blink" | "awaken"
  | `dragging.${PetDragDirection}`
  | "thinking" | "working" | "waiting" | "reminding"
  | "complete" | "error" | "sleeping";

const clip = (
  row: number,
  durationMs: number,
  mode: PetPlaybackMode,
  reducedMotionFrame = 0
): PetBehaviorClip => ({ row, durationMs, mode, reducedMotionFrame });

export const PET_BEHAVIOR_TEMPLATE: PetBehaviorTemplate = {
  idleBase: clip(0, 4800, "loop"),
  idleBlink: clip(1, 360, "once"),
  awaken: clip(2, 840, "once", 5),
  dragging: { durationMs: 600, mode: "loop", reducedMotionFrame: 0 },
  thinking: clip(7, 2800, "loop"),
  working: clip(8, 1400, "loop"),
  waiting: clip(9, 3200, "loop"),
  reminding: clip(10, 800, "once-hold", 5),
  complete: clip(11, 900, "once", 5),
  error: clip(12, 900, "once", 5),
  sleeping: clip(13, 6000, "loop")
};

export const PET_STATE_PRIORITY: PetVisualState[] = [
  "dragging", "error", "complete", "reminding", "awaken",
  "working", "thinking", "waiting", "sleeping", "idle"
];

export function getPetClipSlot(
  state: PetVisualState,
  direction: PetDragDirection,
  blinking: boolean
): PetClipSlot {
  if (state === "idle") return blinking ? "idle.blink" : "idle.base";
  if (state === "dragging") return `dragging.${direction}`;
  return state;
}

export function getPetBehaviorClip(slot: PetClipSlot): PetBehaviorClip {
  if (slot === "idle.base") return PET_BEHAVIOR_TEMPLATE.idleBase;
  if (slot === "idle.blink") return PET_BEHAVIOR_TEMPLATE.idleBlink;
  if (slot.startsWith("dragging.")) {
    const directionRows: Record<PetDragDirection, number> = {
      down: 3, up: 4, right: 5, left: 6
    };
    const direction = slot.slice("dragging.".length) as PetDragDirection;
    return { ...PET_BEHAVIOR_TEMPLATE.dragging, row: directionRows[direction] };
  }
  switch (slot) {
    case "awaken": return PET_BEHAVIOR_TEMPLATE.awaken;
    case "thinking": return PET_BEHAVIOR_TEMPLATE.thinking;
    case "working": return PET_BEHAVIOR_TEMPLATE.working;
    case "waiting": return PET_BEHAVIOR_TEMPLATE.waiting;
    case "reminding": return PET_BEHAVIOR_TEMPLATE.reminding;
    case "complete": return PET_BEHAVIOR_TEMPLATE.complete;
    case "error": return PET_BEHAVIOR_TEMPLATE.error;
    case "sleeping": return PET_BEHAVIOR_TEMPLATE.sleeping;
  }
  throw new Error(`未知桌宠动作槽位：${slot}`);
}
