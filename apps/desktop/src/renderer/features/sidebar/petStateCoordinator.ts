/**
 * 模块用途：用纯状态机协调持续活动、一次性事件与拖动覆盖关系。
 * 模块边界：不创建计时器，不渲染角色，也不读取待办或 AI 业务数据。
 */
import { PET_STATE_PRIORITY } from "./petBehaviorTemplate";
import type {
  PetSustainedState,
  PetTransientState,
  PetVisualState
} from "./petVisualState";

type ActiveSustainedState = Exclude<PetSustainedState, "idle" | "sleeping">;

export interface PetTransientEvent {
  id: number;
  state: PetTransientState;
}

export interface PetStateCoordinator {
  activeEvent: PetTransientEvent | null;
  dragging: boolean;
  queuedEvent: PetTransientEvent | null;
  sleeping: boolean;
  sustainedCounts: Record<ActiveSustainedState, number>;
}

export type PetStateCoordinatorAction =
  | { type: "dragging.changed"; dragging: boolean }
  | { type: "event.emitted"; event: PetTransientEvent }
  | { type: "event.finished"; eventId: number }
  | { type: "sleeping.changed"; sleeping: boolean }
  | { type: "sustained.started"; state: ActiveSustainedState }
  | { type: "sustained.stopped"; state: ActiveSustainedState };

export function createPetStateCoordinator(): PetStateCoordinator {
  return {
    activeEvent: null,
    dragging: false,
    queuedEvent: null,
    sleeping: false,
    sustainedCounts: { thinking: 0, waiting: 0, working: 0 }
  };
}

export function reducePetStateCoordinator(
  state: PetStateCoordinator,
  action: PetStateCoordinatorAction
): PetStateCoordinator {
  switch (action.type) {
    case "dragging.changed":
      return updateDragging(state, action.dragging);
    case "event.emitted":
      return emitEvent(state, action.event);
    case "event.finished":
      return finishEvent(state, action.eventId);
    case "sleeping.changed":
      return { ...state, sleeping: action.sleeping };
    case "sustained.started":
      return updateSustained(state, action.state, 1);
    case "sustained.stopped":
      return updateSustained(state, action.state, -1);
  }
}

export function resolveCoordinatedPetState(state: PetStateCoordinator): PetVisualState {
  if (state.dragging) return "dragging";
  if (state.activeEvent) return state.activeEvent.state;
  if (state.sustainedCounts.working > 0) return "working";
  if (state.sustainedCounts.thinking > 0) return "thinking";
  if (state.sustainedCounts.waiting > 0) return "waiting";
  return state.sleeping ? "sleeping" : "idle";
}

function updateDragging(state: PetStateCoordinator, dragging: boolean): PetStateCoordinator {
  if (dragging === state.dragging) return state;
  if (dragging) {
    return {
      ...state,
      activeEvent: null,
      dragging: true,
      queuedEvent: selectEvent(state.queuedEvent, state.activeEvent)
    };
  }
  return {
    ...state,
    activeEvent: state.queuedEvent,
    dragging: false,
    queuedEvent: null
  };
}

function emitEvent(state: PetStateCoordinator, event: PetTransientEvent): PetStateCoordinator {
  if (state.dragging) {
    return { ...state, queuedEvent: selectEvent(state.queuedEvent, event) };
  }
  if (!state.activeEvent || isAtLeastAsImportant(event, state.activeEvent)) {
    return { ...state, activeEvent: event, queuedEvent: null };
  }
  return { ...state, queuedEvent: selectEvent(state.queuedEvent, event) };
}

function finishEvent(state: PetStateCoordinator, eventId: number): PetStateCoordinator {
  if (state.activeEvent?.id !== eventId) return state;
  return { ...state, activeEvent: state.queuedEvent, queuedEvent: null };
}

function updateSustained(
  state: PetStateCoordinator,
  sustained: ActiveSustainedState,
  delta: number
): PetStateCoordinator {
  return {
    ...state,
    sustainedCounts: {
      ...state.sustainedCounts,
      [sustained]: Math.max(0, state.sustainedCounts[sustained] + delta)
    }
  };
}

function selectEvent(
  current: PetTransientEvent | null,
  candidate: PetTransientEvent | null
): PetTransientEvent | null {
  if (!candidate) return current;
  if (!current || isAtLeastAsImportant(candidate, current)) return candidate;
  return current;
}

function isAtLeastAsImportant(candidate: PetTransientEvent, current: PetTransientEvent): boolean {
  return PET_STATE_PRIORITY.indexOf(candidate.state) <= PET_STATE_PRIORITY.indexOf(current.state);
}
