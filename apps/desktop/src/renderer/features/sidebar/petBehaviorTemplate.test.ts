/**
 * 模块用途：固定十类桌宠状态的统一播放节奏、优先级和静态帧规则。
 * 模块边界：不创建计时器，也不渲染角色图集。
 */
import { describe, expect, it } from "vitest";
import {
  PET_BEHAVIOR_TEMPLATE,
  PET_STATE_PRIORITY,
  getPetClipSlot
} from "./petBehaviorTemplate";

describe("桌宠行为模板", () => {
  it("使用固定十四行动作槽位和统一时长", () => {
    expect(PET_BEHAVIOR_TEMPLATE.idleBase).toMatchObject({ row: 0, durationMs: 4800, mode: "loop" });
    expect(PET_BEHAVIOR_TEMPLATE.idleBlink).toMatchObject({ row: 1, durationMs: 360, mode: "once" });
    expect(PET_BEHAVIOR_TEMPLATE.awaken).toMatchObject({ row: 2, durationMs: 840, mode: "once" });
    expect(PET_BEHAVIOR_TEMPLATE.dragging).toMatchObject({ durationMs: 600, mode: "loop" });
    expect(PET_BEHAVIOR_TEMPLATE.thinking).toMatchObject({ row: 7, durationMs: 2800 });
    expect(PET_BEHAVIOR_TEMPLATE.working).toMatchObject({ row: 8, durationMs: 1400 });
    expect(PET_BEHAVIOR_TEMPLATE.waiting).toMatchObject({ row: 9, durationMs: 3200 });
    expect(PET_BEHAVIOR_TEMPLATE.reminding).toMatchObject({ row: 10, durationMs: 800, mode: "once-hold" });
    expect(PET_BEHAVIOR_TEMPLATE.complete).toMatchObject({ row: 11, durationMs: 900, mode: "once" });
    expect(PET_BEHAVIOR_TEMPLATE.error).toMatchObject({ row: 12, durationMs: 900, mode: "once" });
    expect(PET_BEHAVIOR_TEMPLATE.sleeping).toMatchObject({ row: 13, durationMs: 6000 });
  });

  it("固定状态优先级", () => {
    expect(PET_STATE_PRIORITY).toEqual([
      "dragging", "error", "complete", "reminding", "awaken",
      "working", "thinking", "waiting", "sleeping", "idle"
    ]);
  });

  it("按视觉状态和方向解析角色动作槽位", () => {
    expect(getPetClipSlot("idle", "down", false)).toBe("idle.base");
    expect(getPetClipSlot("idle", "down", true)).toBe("idle.blink");
    expect(getPetClipSlot("dragging", "left", false)).toBe("dragging.left");
    expect(getPetClipSlot("thinking", "down", false)).toBe("thinking");
  });
});
