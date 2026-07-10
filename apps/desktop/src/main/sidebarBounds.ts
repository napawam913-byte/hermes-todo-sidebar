/**
 * 模块用途：计算桌面侧边栏在展开态和桌宠闲置态的窗口位置。
 * 模块边界：只做几何计算，不依赖 Electron 对象，便于测试。
 */
export interface WorkAreaBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SidebarBoundsInput {
  expanded: boolean;
  detailOpen?: boolean;
  workArea: WorkAreaBounds;
}

export interface SidebarWindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const SIDEBAR_EXPANDED_WIDTH = 360;
export const SIDEBAR_DETAIL_WIDTH = 760;
export const DESKTOP_PET_WIDTH = 88;
export const DESKTOP_PET_HEIGHT = 96;
export const DESKTOP_PET_MARGIN = 24;

// [待删除 2026-07-08]
// 原用途：旧版右侧贴边闲置小图标尺寸。
// 替代方案：DESKTOP_PET_WIDTH / DESKTOP_PET_HEIGHT 用于桌宠式悬浮入口。
// 删除条件：用户确认桌宠式入口体验可用后，再请求删除许可。
export const IDLE_ICON_SIZE = 48;

export function calculateSidebarBounds({
  detailOpen = false,
  expanded,
  workArea
}: SidebarBoundsInput): SidebarWindowBounds {
  if (expanded) {
    const width = detailOpen ? SIDEBAR_DETAIL_WIDTH : SIDEBAR_EXPANDED_WIDTH;
    return {
      x: workArea.x + workArea.width - width,
      y: workArea.y,
      width,
      height: workArea.height
    };
  }

  return {
    x: workArea.x + workArea.width - DESKTOP_PET_WIDTH - DESKTOP_PET_MARGIN,
    y: workArea.y + workArea.height - DESKTOP_PET_HEIGHT - DESKTOP_PET_MARGIN,
    width: DESKTOP_PET_WIDTH,
    height: DESKTOP_PET_HEIGHT
  };
}
