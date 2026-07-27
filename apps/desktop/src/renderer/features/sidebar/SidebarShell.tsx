/**
 * 模块用途：根据主进程布局快照组合可拖动桌宠与锚定待办面板。
 * 模块边界：不理解待办数据，也不直接计算显示器坐标。
 */
import { useEffect, useState, type CSSProperties } from "react";
import { normalizePanelOpacity } from "../appearance/appearanceSettings";
import { calculateBrowserPanelSize } from "./browserPanelLayout";
import type { CharacterPack } from "./characterPack";
import { DesktopPetButton } from "./DesktopPetButton";

interface SidebarShellProps {
  activeCount: number;
  characterPack: CharacterPack;
  expanded: boolean;
  panelOpacity: number;
  onExpandedChange: (expanded: boolean) => void;
  children: React.ReactNode;
}

const idleLayout: PetLayoutSnapshot = {
  expanded: false,
  direction: "down",
  panelHeight: 0,
  panelWidth: 0,
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
    "--panel-width": `${layout.panelWidth}px`,
    "--pet-offset-x": `${layout.petOffsetX}px`,
    "--pet-offset-y": `${layout.petOffsetY}px`,
    "--panel-opacity": normalizePanelOpacity(props.panelOpacity) / 100
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
          characterPack={props.characterPack}
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
  if (!expanded) return idleLayout;
  const { panelHeight, panelWidth } = calculateBrowserPanelSize(
    window.innerWidth,
    window.innerHeight
  );
  return {
    expanded,
    direction: "down",
    panelHeight,
    panelWidth,
    petOffsetX: Math.max(0, panelWidth - 88),
    petOffsetY: 0,
    dragging: false
  };
}
