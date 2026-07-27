import { describe, expect, it } from "vitest";
import {
  createPetStateCoordinator,
  reducePetStateCoordinator,
  resolveCoordinatedPetState
} from "./petStateCoordinator";

describe("petStateCoordinator", () => {
  it("按模板优先级选择持续状态", () => {
    let state = createPetStateCoordinator();
    state = reducePetStateCoordinator(state, { type: "sustained.started", state: "waiting" });
    state = reducePetStateCoordinator(state, { type: "sustained.started", state: "thinking" });
    state = reducePetStateCoordinator(state, { type: "sustained.started", state: "working" });

    expect(resolveCoordinatedPetState(state)).toBe("working");
    state = reducePetStateCoordinator(state, { type: "sustained.stopped", state: "working" });
    expect(resolveCoordinatedPetState(state)).toBe("thinking");
  });

  it("拖动期间缓存最新的一次性事件并在松手后播放", () => {
    let state = createPetStateCoordinator();
    state = reducePetStateCoordinator(state, { type: "dragging.changed", dragging: true });
    state = reducePetStateCoordinator(state, {
      type: "event.emitted",
      event: { id: 1, state: "complete" }
    });
    state = reducePetStateCoordinator(state, {
      type: "event.emitted",
      event: { id: 2, state: "error" }
    });

    expect(resolveCoordinatedPetState(state)).toBe("dragging");
    expect(state.queuedEvent).toEqual({ id: 2, state: "error" });
    state = reducePetStateCoordinator(state, { type: "dragging.changed", dragging: false });
    expect(resolveCoordinatedPetState(state)).toBe("error");
  });

  it("高优先级覆盖低优先级，同优先级保留最新事件", () => {
    let state = createPetStateCoordinator();
    state = reducePetStateCoordinator(state, {
      type: "event.emitted",
      event: { id: 1, state: "reminding" }
    });
    state = reducePetStateCoordinator(state, {
      type: "event.emitted",
      event: { id: 2, state: "complete" }
    });
    state = reducePetStateCoordinator(state, {
      type: "event.emitted",
      event: { id: 3, state: "complete" }
    });

    expect(state.activeEvent).toEqual({ id: 3, state: "complete" });
    expect(state.queuedEvent).toBeNull();
    state = reducePetStateCoordinator(state, { type: "event.finished", eventId: 2 });
    expect(resolveCoordinatedPetState(state)).toBe("complete");
    state = reducePetStateCoordinator(state, { type: "event.finished", eventId: 3 });
    expect(resolveCoordinatedPetState(state)).toBe("idle");
  });

  it("低优先级事件只占用一个候选槽位", () => {
    let state = createPetStateCoordinator();
    state = reducePetStateCoordinator(state, {
      type: "event.emitted",
      event: { id: 1, state: "error" }
    });
    state = reducePetStateCoordinator(state, {
      type: "event.emitted",
      event: { id: 2, state: "awaken" }
    });
    state = reducePetStateCoordinator(state, {
      type: "event.emitted",
      event: { id: 3, state: "reminding" }
    });

    expect(state.queuedEvent).toEqual({ id: 3, state: "reminding" });
    state = reducePetStateCoordinator(state, { type: "event.finished", eventId: 1 });
    expect(resolveCoordinatedPetState(state)).toBe("reminding");
  });
});
