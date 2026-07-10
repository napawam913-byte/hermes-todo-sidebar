import { describe, expect, it } from "vitest";
import { calculateSidebarBounds } from "./sidebarBounds.js";

describe("calculateSidebarBounds", () => {
  it("places the expanded panel over the right edge of the work area", () => {
    const bounds = calculateSidebarBounds({
      expanded: true,
      workArea: { x: 0, y: 40, width: 1440, height: 860 }
    });

    expect(bounds).toEqual({
      x: 1080,
      y: 40,
      width: 360,
      height: 860
    });
  });

  it("widens the native window for the fixed detail pane", () => {
    const bounds = calculateSidebarBounds({
      expanded: true,
      detailOpen: true,
      workArea: { x: 0, y: 40, width: 1440, height: 860 }
    });

    expect(bounds).toEqual({
      x: 680,
      y: 40,
      width: 760,
      height: 860
    });
  });

  it("places the idle desktop pet above the lower-right corner", () => {
    const bounds = calculateSidebarBounds({
      expanded: false,
      workArea: { x: 0, y: 40, width: 1440, height: 860 }
    });

    expect(bounds).toEqual({
      x: 1328,
      y: 780,
      width: 88,
      height: 96
    });
  });
});
