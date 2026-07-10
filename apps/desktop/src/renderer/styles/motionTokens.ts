/**
 * 模块用途：集中声明前端动效时间、缓动和降级策略。
 * 模块边界：只导出 motion token，不直接操作 DOM 或组件状态。
 */
export const motionTokens = {
  sidebar: {
    expandMs: 220,
    collapseMs: 180,
    easing: "cubic-bezier(0.2, 0.8, 0.2, 1)"
  },
  dropdown: {
    enterMs: 140,
    yOffsetPx: -6
  },
  button: {
    hoverMs: 120,
    pressMs: 80,
    releaseMs: 120,
    pressScale: 0.98
  },
  todo: {
    completeFadeMs: 180,
    reflowMs: 160,
    reminderFlashMs: 480
  },
  sync: {
    statusFadeMs: 120
  }
} as const;
export const reducedMotionTokens = {
  allowTransform: false,
  allowScale: false,
  allowOpacity: true
} as const;
