/**
 * 模块用途：把桌宠指针事件连接到已测试的拖动交互协调器。
 * 模块边界：不计算屏幕坐标，不直接调用 Electron IPC 通道名。
 */
import { useMemo, useState, type MouseEvent, type PointerEvent } from "react";
import { PetDragInteraction } from "./petDragInteraction";

interface UsePetDragOptions {
  enabled: boolean;
  onActivate: () => void;
}

export function usePetDrag({ enabled, onActivate }: UsePetDragOptions) {
  const [dragging, setDragging] = useState(false);
  const interaction = useMemo(() => window.hermesPet
    ? new PetDragInteraction({
        bridge: window.hermesPet,
        onActivate,
        onDraggingChange: setDragging
      })
    : undefined, [onActivate]);

  function onPointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (enabled && interaction) void interaction.start();
  }

  function onPointerMove() {
    if (enabled && interaction) void interaction.move();
  }

  function onPointerUp(event: PointerEvent<HTMLButtonElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (enabled && interaction) void interaction.end();
    else onActivate();
  }

  function onPointerCancel() {
    if (enabled && interaction) void interaction.cancel();
  }

  function onClick(event: MouseEvent<HTMLButtonElement>) {
    if (event.detail === 0) onActivate();
  }

  return {
    dragging,
    pointerHandlers: { onClick, onPointerCancel, onPointerDown, onPointerMove, onPointerUp }
  };
}
