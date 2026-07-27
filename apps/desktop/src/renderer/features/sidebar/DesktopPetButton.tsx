/**
 * 模块用途：桌宠式闲置入口，第一版只显示待办数量并触发展开。
 * 模块边界：只负责桌面悬浮入口展示，不读取或修改待办数据。
 */
import { useCallback, useEffect } from "react";
import type { CharacterPack } from "./characterPack";
import { PetSprite } from "./PetSprite";
import { usePetActivity } from "./PetActivityContext";
import { usePetDrag } from "./usePetDrag";

interface DesktopPetButtonProps {
  activeCount: number;
  characterPack: CharacterPack;
  expanded: boolean;
  onActivate: () => void;
}

export function DesktopPetButton({ activeCount, characterPack, expanded, onActivate }: DesktopPetButtonProps) {
  const activity = usePetActivity();
  const activate = useCallback(() => {
    if (!expanded) activity.awaken();
    onActivate();
  }, [activity.awaken, expanded, onActivate]);
  const { dragDirection, dragging, moving, pointerHandlers } = usePetDrag({
    enabled: !expanded,
    onActivate: activate
  });

  useEffect(() => activity.setDragging(dragging), [activity.setDragging, dragging]);
  useEffect(() => activity.setExpanded(expanded), [activity.setExpanded, expanded]);

  return (
    <button
      {...pointerHandlers}
      className={dragging ? "desktop-pet-button is-dragging" : "desktop-pet-button"}
      type="button"
      aria-label={expanded ? "收起待办面板" : "打开待办面板"}
      aria-pressed={expanded}
    >
      <span className="desktop-pet-character">
        <PetSprite
          blinking={activity.blinking}
          direction={dragDirection}
          moving={moving}
          pack={characterPack}
          state={dragging ? "dragging" : activity.visualState}
        />
      </span>
      {activeCount > 0 ? <span className="desktop-pet-count">{activeCount}</span> : null}
    </button>
  );
}
