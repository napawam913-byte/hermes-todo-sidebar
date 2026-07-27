/**
 * 模块用途：按照角色包、视觉状态和拖动方向播放统一六帧图集。
 * 模块边界：只渲染角色本体，不处理徽标、Pointer 事件或窗口移动。
 */
import type { CSSProperties } from "react";
import type { CharacterPack } from "./characterPack";
import { resolveCharacterClip } from "./characterClipResolver";
import { getPetBehaviorClip, getPetClipSlot } from "./petBehaviorTemplate";
import type { PetDragDirection } from "./petDragDirection";
import type { PetVisualState } from "./petVisualState";

interface PetSpriteProps {
  blinking?: boolean;
  direction: PetDragDirection;
  moving: boolean;
  pack: CharacterPack;
  state: PetVisualState;
}

export function PetSprite({ blinking = false, direction, moving, pack, state }: PetSpriteProps) {
  const slot = getPetClipSlot(state, direction, blinking);
  const clip = resolveCharacterClip(pack.manifest, slot);
  const behavior = getPetBehaviorClip(slot);
  const atlas = pack.manifest.atlas;
  const resting = state === "dragging" && !moving;
  const className = [
    "pet-sprite-frame",
    clip.mirrorX ? "is-mirrored" : "",
    resting ? "is-resting" : ""
  ].filter(Boolean).join(" ");
  const style = {
    "--pet-atlas-url": `url("${pack.atlasUrl}")`,
    "--pet-atlas-width": `${atlas.columns * atlas.renderWidth}px`,
    "--pet-atlas-height": `${atlas.rows * atlas.renderHeight}px`,
    "--pet-duration": `${behavior.durationMs}ms`,
    "--pet-final-x": `${-5 * atlas.renderWidth}px`,
    "--pet-iterations": behavior.mode === "loop" ? "infinite" : "1",
    "--pet-reduced-x": `${-behavior.reducedMotionFrame * atlas.renderWidth}px`,
    "--pet-row-offset": `${-clip.row * atlas.renderHeight}px`,
    height: `${atlas.renderHeight}px`,
    width: `${atlas.renderWidth}px`
  } as CSSProperties;

  return (
    <span className="pet-sprite-shell" aria-hidden="true" data-pet-clip={slot} data-pet-state={state}>
      <span className={className} style={style} />
    </span>
  );
}
