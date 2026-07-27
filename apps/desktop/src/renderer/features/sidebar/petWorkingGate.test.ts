import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PetWorkingGate } from "./petWorkingGate";

describe("PetWorkingGate", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("短于 180ms 的操作不会显示工作状态", () => {
    const changes: boolean[] = [];
    const gate = new PetWorkingGate((visible) => changes.push(visible));
    const finish = gate.begin();

    vi.advanceTimersByTime(179);
    finish();
    vi.runAllTimers();

    expect(changes).toEqual([]);
  });

  it("显示后至少停留 450ms", () => {
    const changes: boolean[] = [];
    const gate = new PetWorkingGate((visible) => changes.push(visible));
    const finish = gate.begin();

    vi.advanceTimersByTime(180);
    expect(changes).toEqual([true]);
    vi.advanceTimersByTime(20);
    finish();
    vi.advanceTimersByTime(429);
    expect(changes).toEqual([true]);
    vi.advanceTimersByTime(1);
    expect(changes).toEqual([true, false]);
  });

  it("重叠操作复用同一个可见周期", () => {
    const changes: boolean[] = [];
    const gate = new PetWorkingGate((visible) => changes.push(visible));
    const finishFirst = gate.begin();
    vi.advanceTimersByTime(180);
    const finishSecond = gate.begin();
    finishFirst();
    vi.advanceTimersByTime(500);
    expect(changes).toEqual([true]);
    finishSecond();
    vi.runAllTimers();
    expect(changes).toEqual([true, false]);
  });
});
