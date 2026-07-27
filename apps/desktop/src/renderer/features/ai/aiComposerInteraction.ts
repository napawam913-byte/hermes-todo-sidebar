/**
 * 模块用途：提供 AI 输入框的按键发送与高度计算规则。
 * 模块边界：保持为无 DOM 依赖的纯函数，便于组件和测试复用。
 */
export interface ComposerKeySample {
  key: string;
  shiftKey: boolean;
  isComposing: boolean;
}

export function shouldSubmitComposer(sample: ComposerKeySample): boolean {
  return sample.key === "Enter" && !sample.shiftKey && !sample.isComposing;
}

export function clampComposerHeight(scrollHeight: number): number {
  return Math.min(120, Math.max(44, scrollHeight));
}
