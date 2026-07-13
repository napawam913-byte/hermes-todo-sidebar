/**
 * 模块用途：根据主进程布局快照组合可拖动桌宠与锚定待办面板。
 * 模块边界：不理解待办数据，也不直接计算显示器坐标。
 */
import { useEffect, useState, type CSSProperties } from "react";
import { DesktopPetButton } from "./DesktopPetButton";

interface SidebarShellProps {
  activeCount: number;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  children: React.ReactNode;
}

const idleLayout: PetLayoutSnapshot = {
  expanded: false,
  direction: "down",
  panelHeight: 0,
  petOffsetX: 0,
  petOffsetY: 0,
  dragging: false
};

export function SidebarShell(props: SidebarShellProps) {
  const [layout, setLayout] = useState<PetLayoutSnapshot>(idleLayout);

  useEffect(() => {
    if (!window.hermesPet) {
      setLayout(createBrowserLayout(props.expanded));
      return;
    }
    void window.hermesPet.setExpanded(props.expanded).then(setLayout);
  }, [props.expanded]);

  useEffect(() => {
    void window.hermesPet?.getLayout().then(setLayout);
    const disposeLayout = window.hermesPet?.onLayoutChanged(setLayout);
    const disposeCollapse = window.hermesSidebar?.onCollapseRequested(() =>
      props.onExpandedChange(false));
    const disposeExpand = window.hermesSidebar?.onExpandRequested(() =>
      props.onExpandedChange(true));
    return () => {
      disposeLayout?.();
      disposeCollapse?.();
      disposeExpand?.();
    };
  }, [props.onExpandedChange]);

  const style = {
    "--panel-height": `${layout.panelHeight}px`,
    "--pet-offset-x": `${layout.petOffsetX}px`,
    "--pet-offset-y": `${layout.petOffsetY}px`
  } as CSSProperties;
  const className = [
    "sidebar-shell",
    props.expanded ? "is-expanded" : "is-idle",
    `opens-${layout.direction}`
  ].join(" ");

  return (
    <aside className={className} style={style}>
      <div className="desktop-pet-anchor">
        <DesktopPetButton
          activeCount={props.activeCount}
          expanded={props.expanded}
          onActivate={() => props.onExpandedChange(!props.expanded)}
        />
      </div>
      <section className="sidebar-content" aria-hidden={!props.expanded}>
        {props.children}
      </section>
    </aside>
  );
}

function createBrowserLayout(expanded: boolean): PetLayoutSnapshot {
  return expanded
    ? { expanded, direction: "down", panelHeight: 560, petOffsetX: 272, petOffsetY: 0, dragging: false }
    : idleLayout;
}
