/**
 * 模块用途：定义桌宠视觉状态及状态优先级。
 * 模块边界：不处理计时、图片加载、Electron 坐标或业务数据写入。
 */
import type { AppMutationOperation } from "../../../shared/appMutationTypes";

export type PetSustainedState = "idle" | "thinking" | "working" | "waiting" | "sleeping";
export type PetTransientState = "awaken" | "reminding" | "complete" | "error";
export type PetActivityState = PetSustainedState | Exclude<PetTransientState, "awaken" | "reminding">;
export type PetVisualState = PetSustainedState | PetTransientState | "dragging";

interface ResolvePetVisualStateInput {
  activity: PetActivityState;
  awakening: boolean;
  dragging: boolean;
}

// [待删除-2026-07-21] V2 直接状态解析器；V3 由 petStateCoordinator 统一仲裁。
export function resolvePetVisualState(input: ResolvePetVisualStateInput): PetVisualState {
  if (input.dragging) return "dragging";
  if (input.activity === "complete") return "complete";
  if (input.activity === "working") return "working";
  if (input.awakening) return "awaken";
  return "idle";
}

export function shouldCelebrateOperations(operations: AppMutationOperation[]): boolean {
  return operations.some((operation) =>
    operation.type === "todo.complete" || operation.type === "cyclePlan.entry.complete");
}
