import { describe, expect, it } from "vitest";
import { motionTokens, reducedMotionTokens } from "./motionTokens";

describe("motionTokens", () => {
  it("matches the planned sidebar timing contract", () => {
    expect(motionTokens.sidebar.expandMs).toBe(220);
    expect(motionTokens.sidebar.collapseMs).toBe(180);
    expect(motionTokens.sidebar.easing).toBe("cubic-bezier(0.2, 0.8, 0.2, 1)");
  });

  it("keeps dropdown and completion motion short enough for task flow", () => {
    expect(motionTokens.dropdown.enterMs).toBe(140);
    expect(motionTokens.todo.completeFadeMs).toBe(180);
    expect(motionTokens.todo.reflowMs).toBe(160);
  });

  it("removes movement and scale in reduced motion mode", () => {
    expect(reducedMotionTokens.allowTransform).toBe(false);
    expect(reducedMotionTokens.allowScale).toBe(false);
    expect(reducedMotionTokens.allowOpacity).toBe(true);
  });
});
