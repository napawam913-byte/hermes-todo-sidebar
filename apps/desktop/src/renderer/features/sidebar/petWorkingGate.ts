/**
 * 模块用途：为工作状态提供 180ms 延迟显示与 450ms 最短停留，避免短操作闪烁。
 * 模块边界：只管理可见门控，不判断业务成功失败，也不选择角色动作。
 */
const REVEAL_DELAY_MS = 180;
const MIN_VISIBLE_MS = 450;

export class PetWorkingGate {
  private activeCount = 0;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private revealTimer: ReturnType<typeof setTimeout> | null = null;
  private visible = false;
  private visibleAt = 0;

  constructor(
    private readonly onVisibleChange: (visible: boolean) => void,
    private readonly now: () => number = () => Date.now()
  ) {}

  begin(): () => void {
    this.activeCount += 1;
    this.clearHideTimer();
    if (!this.visible && !this.revealTimer) {
      this.revealTimer = setTimeout(() => this.reveal(), REVEAL_DELAY_MS);
    }
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      this.finishOne();
    };
  }

  dispose(): void {
    this.clearHideTimer();
    this.clearRevealTimer();
    this.activeCount = 0;
  }

  private reveal(): void {
    this.revealTimer = null;
    if (this.activeCount === 0 || this.visible) return;
    this.visible = true;
    this.visibleAt = this.now();
    this.onVisibleChange(true);
  }

  private finishOne(): void {
    this.activeCount = Math.max(0, this.activeCount - 1);
    if (this.activeCount > 0) return;
    if (!this.visible) {
      this.clearRevealTimer();
      return;
    }
    const remaining = Math.max(0, MIN_VISIBLE_MS - (this.now() - this.visibleAt));
    this.hideTimer = setTimeout(() => this.hide(), remaining);
  }

  private hide(): void {
    this.hideTimer = null;
    if (this.activeCount > 0 || !this.visible) return;
    this.visible = false;
    this.onVisibleChange(false);
  }

  private clearHideTimer(): void {
    if (!this.hideTimer) return;
    clearTimeout(this.hideTimer);
    this.hideTimer = null;
  }

  private clearRevealTimer(): void {
    if (!this.revealTimer) return;
    clearTimeout(this.revealTimer);
    this.revealTimer = null;
  }
}
