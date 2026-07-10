/**
 * [待删除 2026-07-08]
 * 原用途：侧边栏收起态的全高窄条入口。
 * 替代方案：IdleIconButton 提供右侧边缘小图标入口，符合闲置态设计。
 * 删除条件：用户确认小图标闲置态体验可用后，再请求删除许可。
 *
 * 模块用途：侧边栏收起态的窄条入口，显示待办数量和提醒红点。
 * 模块边界：只负责入口展示和 toggle 事件。
 */
import { Bell, ChevronLeft, ChevronRight } from "lucide-react";

interface EdgeHandleProps {
  activeCount: number;
  overdueCount: number;
  expanded: boolean;
  onToggle: () => void;
}

export function EdgeHandle({ activeCount, expanded, overdueCount, onToggle }: EdgeHandleProps) {
  const Chevron = expanded ? ChevronRight : ChevronLeft;

  return (
    <button className="edge-handle" type="button" onClick={onToggle} aria-label="Toggle todo sidebar">
      <span className="edge-handle-mark">
        <Bell size={17} strokeWidth={1.8} />
        {overdueCount > 0 ? <span className="edge-alert-dot" /> : null}
      </span>
      <span className="edge-count">{activeCount}</span>
      <Chevron size={16} strokeWidth={1.8} />
    </button>
  );
}
