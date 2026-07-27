import { describe, expect, it } from "vitest";
import { resolvePetVisualState, shouldCelebrateOperations } from "./petVisualState";

describe("resolvePetVisualState", () => {
  it("gives dragging the highest priority", () => {
    expect(resolvePetVisualState({
      activity: "complete",
      awakening: true,
      dragging: true
    })).toBe("dragging");
  });

  it("uses activity before the temporary awaken state", () => {
    expect(resolvePetVisualState({
      activity: "working",
      awakening: true,
      dragging: false
    })).toBe("working");
  });

  it("falls back to idle", () => {
    expect(resolvePetVisualState({
      activity: "idle",
      awakening: false,
      dragging: false
    })).toBe("idle");
  });
});

describe("shouldCelebrateOperations", () => {
  it("recognizes todo and cycle entry completion", () => {
    expect(shouldCelebrateOperations([{ type: "todo.complete", targetId: "todo-1" }])).toBe(true);
    expect(shouldCelebrateOperations([
      { type: "cyclePlan.entry.complete", targetId: "entry-1" }
    ])).toBe(true);
  });

  it("does not celebrate ordinary edits", () => {
    expect(shouldCelebrateOperations([
      { type: "todo.update", targetId: "todo-1", patch: { title: "修改" } }
    ])).toBe(false);
  });
});
