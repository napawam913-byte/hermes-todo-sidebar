/**
 * 模块用途：桌面侧边栏壳层，管理展开面板和桌宠式闲置入口。
 * 模块边界：不理解待办内容，只接收数量与子内容。
 */
import { useEffect } from "react";
import { DesktopPetButton } from "./DesktopPetButton";

interface SidebarShellProps {
  activeCount: number;
  detailOpen: boolean;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  children: React.ReactNode;
}

export function SidebarShell({
  activeCount,
  children,
  detailOpen,
  expanded,
  onExpandedChange
}: SidebarShellProps) {
  useEffect(() => {
    void window.hermesSidebar?.setExpanded(expanded);
  }, [expanded]);

  useEffect(() => {
    void window.hermesSidebar?.setDetailOpen(detailOpen);
  }, [detailOpen]);

  useEffect(() => {
    const disposeCollapse = window.hermesSidebar?.onCollapseRequested(() => onExpandedChange(false));
    const disposeExpand = window.hermesSidebar?.onExpandRequested(() => onExpandedChange(true));

    return () => {
      disposeCollapse?.();
      disposeExpand?.();
    };
  }, [onExpandedChange]);

  return (
    <aside className={expanded ? "sidebar-shell is-expanded" : "sidebar-shell is-idle"}>
      {!expanded ? (
        <DesktopPetButton
          activeCount={activeCount}
          onOpen={() => onExpandedChange(true)}
        />
      ) : null}
      <section className="sidebar-content" aria-hidden={!expanded}>
        {children}
      </section>
    </aside>
  );
}
