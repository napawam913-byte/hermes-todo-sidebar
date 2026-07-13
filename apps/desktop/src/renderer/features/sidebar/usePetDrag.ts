/**
 * 模块用途：把桌宠指针事件连接到已测试的拖动交互协调器。
 * 模块边界：不计算屏幕坐标，不直接调用 Electron IPC 通道名。
 */
import { useRef, useState, type MouseEvent, type PointerEvent } from "react";
import type {
  PetDragPointerSample,
  PetDragStartSample
} from "../../../shared/petDragContract";
import { PetDragInteraction } from "./petDragInteraction";

interface UsePetDragOptions {
  enabled: boolean;
  onActivate: () => void;
}

export function usePetDrag({ enabled, onActivate }: UsePetDragOptions) {
  const [dragging, setDragging] = useState(false);
  const interactionRef = useRef<PetDragInteraction | undefined>(undefined);
  if (!interactionRef.current && window.hermesPet) {
    interactionRef.current = new PetDragInteraction({
      bridge: window.hermesPet,
      onActivate,
      onDraggingChange: setDragging
    });
  }
  const interaction = interactionRef.current;
  interaction?.setOnActivate(onActivate);

  function onPointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (!enabled || event.button !== 0 || !interaction) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    interaction.start(toStartSample(event));
  }

  function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (enabled && interaction) interaction.move(toPointerSample(event));
  }

  function onPointerUp(event: PointerEvent<HTMLButtonElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (enabled && interaction) interaction.end(toPointerSample(event));
  }

  function onPointerCancel(event: PointerEvent<HTMLButtonElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (enabled && interaction) interaction.cancel(event.pointerId);
  }

  function onClick(event: MouseEvent<HTMLButtonElement>) {
    if (!enabled || event.detail === 0) onActivate();
  }

  return {
    dragging,
    pointerHandlers: { onClick, onPointerCancel, onPointerDown, onPointerMove, onPointerUp }
  };
}

function toStartSample(event: PointerEvent<HTMLElement>): PetDragStartSample {
  return {
    ...toPointerSample(event),
    clientX: event.clientX,
    clientY: event.clientY
  };
}

function toPointerSample(event: PointerEvent<HTMLElement>): PetDragPointerSample {
  return {
    pointerId: event.pointerId,
    screenX: event.screenX,
    screenY: event.screenY,
    timeMs: event.timeStamp
  };
}
