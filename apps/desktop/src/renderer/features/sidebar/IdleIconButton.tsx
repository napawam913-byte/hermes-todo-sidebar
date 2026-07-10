/**
 * [待删除 2026-07-08]
 * 原用途：闲置态右侧小图标入口。
 * 替代方案：DesktopPetButton 提供桌宠式悬浮入口。
 * 删除条件：用户确认桌宠式入口体验可用后，再请求删除许可。
 *
 * 模块用途：闲置态右侧小图标入口，显示待办数量和到点红点。
 * 模块边界：只负责收起态入口展示和展开事件。
 */
import { Bell } from "lucide-react";

interface IdleIconButtonProps {
  activeCount: number;
  overdueCount: number;
  onOpen: () => void;
}

export function IdleIconButton({ activeCount, overdueCount, onOpen }: IdleIconButtonProps) {
  return (
    <button className="idle-icon-button" type="button" onClick={onOpen} aria-label="打开待办侧边栏">
      <Bell size={19} strokeWidth={1.9} />
      {activeCount > 0 ? <span className="idle-count">{activeCount}</span> : null}
      {overdueCount > 0 ? <span className="idle-alert-dot" /> : null}
    </button>
  );
}
