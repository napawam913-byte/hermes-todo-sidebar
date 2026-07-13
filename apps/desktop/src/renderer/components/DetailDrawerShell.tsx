/**
 * [待删除 2026-07-13]
 * 替代方案：DetailPageShell 在同一个 360px 面板内切换详情。
 * 删除条件：用户确认 0.1.2 测试副本的详情返回流程可用。
 * 模块用途：提供今日待办与周期任务共用的固定右侧详情壳层。
 * 模块边界：只负责标题、关闭、分隔和滚动，不理解任何待办领域数据。
 */
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { IconButton } from "./buttons";

interface DetailDrawerShellProps {
  children: ReactNode;
  label: string;
  title: string;
  onClose: () => void;
}

export function DetailDrawerShell({ children, label, onClose, title }: DetailDrawerShellProps) {
  return (
    <>
      <div className="detail-drawer-divider" aria-hidden="true" />
      <aside className="detail-drawer" aria-label={`${title}详情抽屉`}>
        <header className="detail-drawer-header">
          <div>
            <p>{label}</p>
            <h2>{title}</h2>
          </div>
          <IconButton icon={<X size={17} strokeWidth={1.8} />} onClick={onClose}>
            关闭详情
          </IconButton>
        </header>
        {children}
      </aside>
    </>
  );
}
