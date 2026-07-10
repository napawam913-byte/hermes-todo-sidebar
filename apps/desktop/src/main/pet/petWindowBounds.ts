/**
 * 模块用途：提供桌宠入口与展开面板的窗口几何计算入口。
 * 模块边界：复用 sidebarBounds 的纯计算，不直接操作 BrowserWindow。
 */
import { calculateSidebarBounds } from "../sidebarBounds.js";
import type { SidebarWindowBounds, WorkAreaBounds } from "../sidebarBounds.js";

export function calculatePetIdleBounds(workArea: WorkAreaBounds): SidebarWindowBounds {
  return calculateSidebarBounds({
    expanded: false,
    workArea
  });
}

export function calculateExpandedPanelBounds(workArea: WorkAreaBounds): SidebarWindowBounds {
  return calculateSidebarBounds({
    expanded: true,
    workArea
  });
}
