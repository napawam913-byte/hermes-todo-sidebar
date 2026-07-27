/**
 * 模块用途：统一协调桌宠持续活动、一次性动作、拖动、眨眼和睡眠。
 * 模块边界：不读取业务数据，不移动窗口，也不决定角色图集内容。
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode
} from "react";
import { getPetBehaviorClip } from "./petBehaviorTemplate";
import {
  createPetStateCoordinator,
  reducePetStateCoordinator,
  resolveCoordinatedPetState
} from "./petStateCoordinator";
import type { PetSustainedState, PetTransientState, PetVisualState } from "./petVisualState";
import { PetWorkingGate } from "./petWorkingGate";
import { usePetAmbientState } from "./usePetAmbientState";

interface PetActivityController {
  blinking: boolean;
  visualState: PetVisualState;
  beginThinking(): () => void;
  beginWaiting(): () => void;
  beginWorking(): () => void;
  celebrate(): void;
  fail(): void;
  remind(): void;
  awaken(): void;
  recordInteraction(): void;
  setDragging(dragging: boolean): void;
  setExpanded(expanded: boolean): void;
}

const fallbackController: PetActivityController = {
  blinking: false,
  visualState: "idle",
  beginThinking: () => () => undefined,
  beginWaiting: () => () => undefined,
  beginWorking: () => () => undefined,
  celebrate: () => undefined,
  fail: () => undefined,
  remind: () => undefined,
  awaken: () => undefined,
  recordInteraction: () => undefined,
  setDragging: () => undefined,
  setExpanded: () => undefined
};
const PetActivityContext = createContext<PetActivityController>(fallbackController);

export function PetActivityProvider({ children }: { children: ReactNode }) {
  const [coordinator, dispatch] = useReducer(
    reducePetStateCoordinator,
    undefined,
    createPetStateCoordinator
  );
  const [expanded, setExpandedState] = useState(false);
  const [interactionVersion, setInteractionVersion] = useState(0);
  const eventId = useRef(0);
  const lastInteractionAt = useRef(Date.now());
  const workingGate = useRef<PetWorkingGate | null>(null);
  if (!workingGate.current) {
    workingGate.current = new PetWorkingGate((visible) => dispatch({
      type: visible ? "sustained.started" : "sustained.stopped",
      state: "working"
    }));
  }

  const recordInteraction = useCallback(() => {
    lastInteractionAt.current = Date.now();
    setInteractionVersion((version) => version + 1);
    dispatch({ type: "sleeping.changed", sleeping: false });
  }, []);

  const beginSustained = useCallback((state: Exclude<PetSustainedState, "idle" | "sleeping">) => {
    recordInteraction();
    dispatch({ type: "sustained.started", state });
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      dispatch({ type: "sustained.stopped", state });
    };
  }, [recordInteraction]);

  const beginWorking = useCallback(() => {
    recordInteraction();
    return workingGate.current?.begin() ?? (() => undefined);
  }, [recordInteraction]);

  const emit = useCallback((state: PetTransientState) => {
    eventId.current += 1;
    dispatch({ type: "event.emitted", event: { id: eventId.current, state } });
  }, []);
  const beginThinking = useCallback(() => beginSustained("thinking"), [beginSustained]);
  const beginWaiting = useCallback(() => beginSustained("waiting"), [beginSustained]);
  const celebrate = useCallback(() => emit("complete"), [emit]);
  const fail = useCallback(() => emit("error"), [emit]);
  const remind = useCallback(() => emit("reminding"), [emit]);
  const awaken = useCallback(() => emit("awaken"), [emit]);
  const setDragging = useCallback((dragging: boolean) => {
    if (dragging) recordInteraction();
    dispatch({ type: "dragging.changed", dragging });
  }, [recordInteraction]);
  const setExpanded = useCallback((next: boolean) => {
    setExpandedState(next);
    if (next) recordInteraction();
  }, [recordInteraction]);

  useEffect(() => {
    const active = coordinator.activeEvent;
    if (!active) return;
    const timer = setTimeout(() => dispatch({
      type: "event.finished",
      eventId: active.id
    }), getPetBehaviorClip(active.state).durationMs);
    return () => clearTimeout(timer);
  }, [coordinator.activeEvent]);

  useEffect(() => () => workingGate.current?.dispose(), []);

  const visualState = resolveCoordinatedPetState(coordinator);
  const onSleepingChange = useCallback((sleeping: boolean) => {
    dispatch({ type: "sleeping.changed", sleeping });
  }, []);
  const blinking = usePetAmbientState({
    expanded,
    interactionVersion,
    lastInteractionAt,
    onSleepingChange,
    visualState
  });
  const value = useMemo(
    () => ({
      blinking,
      visualState,
      beginThinking,
      beginWaiting,
      beginWorking,
      celebrate,
      fail,
      remind,
      awaken,
      recordInteraction,
      setDragging,
      setExpanded
    }),
    [
      awaken, beginThinking, beginWaiting, beginWorking, blinking, celebrate,
      fail, recordInteraction, remind, setDragging, setExpanded, visualState
    ]
  );

  return <PetActivityContext.Provider value={value}>{children}</PetActivityContext.Provider>;
}

export function usePetActivity(): PetActivityController {
  return useContext(PetActivityContext);
}
