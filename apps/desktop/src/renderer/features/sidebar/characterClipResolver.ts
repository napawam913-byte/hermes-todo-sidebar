/**
 * 模块用途：把统一动作槽位解析为当前角色包中的图集行。
 * 模块边界：不决定播放速度、循环方式或视觉状态优先级。
 */
import type { CharacterClipV3, CharacterPackManifestV3 } from "./characterPackV3";
import type { PetClipSlot } from "./petBehaviorTemplate";

export function resolveCharacterClip(
  manifest: CharacterPackManifestV3,
  slot: PetClipSlot
): CharacterClipV3 {
  if (slot === "idle.base") return manifest.clips.idle.base;
  if (slot === "idle.blink") return manifest.clips.idle.blink;
  if (slot.startsWith("dragging.")) {
    const direction = slot.slice("dragging.".length) as keyof typeof manifest.clips.dragging;
    return manifest.clips.dragging[direction];
  }
  switch (slot) {
    case "awaken": return manifest.clips.awaken;
    case "thinking": return manifest.clips.thinking;
    case "working": return manifest.clips.working;
    case "waiting": return manifest.clips.waiting;
    case "reminding": return manifest.clips.reminding;
    case "complete": return manifest.clips.complete;
    case "error": return manifest.clips.error;
    case "sleeping": return manifest.clips.sleeping;
  }
  throw new Error(`未知角色动作槽位：${slot}`);
}
