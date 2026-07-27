/**
 * 模块用途：把眨眼与收起睡眠策略接入 React 计时器。
 * 模块边界：不选择业务状态，不持久化提醒记录，也不触发一次性动作。
 */
import { useEffect, useRef, useState } from "react";
import {
  getNextBlinkDelay,
  PET_SLEEP_AFTER_MS,
  shouldEnterPetSleep
} from "./petAmbientPolicy";
import type { PetVisualState } from "./petVisualState";

interface PetAmbientOptions {
  expanded: boolean;
  interactionVersion: number;
  lastInteractionAt: React.MutableRefObject<number>;
  onSleepingChange(sleeping: boolean): void;
  visualState: PetVisualState;
}

export function usePetAmbientState(options: PetAmbientOptions): boolean {
  const [blinking, setBlinking] = useState(false);
  const randomRef = useRef(Math.random);

  useEffect(() => {
    if (options.visualState !== "idle") {
      setBlinking(false);
      return;
    }
    let blinkEnd: ReturnType<typeof setTimeout> | null = null;
    let nextBlink: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      nextBlink = setTimeout(() => {
        setBlinking(true);
        blinkEnd = setTimeout(() => {
          setBlinking(false);
          schedule();
        }, 360);
      }, getNextBlinkDelay(randomRef.current));
    };
    schedule();
    return () => {
      if (nextBlink) clearTimeout(nextBlink);
      if (blinkEnd) clearTimeout(blinkEnd);
    };
  }, [options.visualState]);

  useEffect(() => {
    if (options.expanded) {
      options.onSleepingChange(false);
      return;
    }
    const elapsed = Date.now() - options.lastInteractionAt.current;
    const delay = Math.max(0, PET_SLEEP_AFTER_MS - elapsed);
    const timer = setTimeout(() => {
      options.onSleepingChange(shouldEnterPetSleep({
        expanded: false,
        lastInteractionAt: options.lastInteractionAt.current,
        now: Date.now()
      }));
    }, delay);
    return () => clearTimeout(timer);
  }, [
    options.expanded,
    options.interactionVersion,
    options.lastInteractionAt,
    options.onSleepingChange
  ]);

  return blinking;
}
