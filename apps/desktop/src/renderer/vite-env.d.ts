/// <reference types="vite/client" />

interface DesktopAppState {
  schemaVersion: 1;
  todos: unknown[];
  cyclePlans: unknown[];
  settings: { launchAtLogin: boolean };
  updatedAt: string;
}

interface Window {
  hermesAppData?: {
    loadState: () => Promise<DesktopAppState>;
    replaceTodos: (todos: unknown[]) => Promise<DesktopAppState>;
    replaceCyclePlans: (cyclePlans: unknown[]) => Promise<DesktopAppState>;
    onReloadRequested: (callback: () => void) => () => void;
  };
  hermesSidebar?: {
    onCollapseRequested: (callback: () => void) => () => void;
    onExpandRequested: (callback: () => void) => () => void;
  };
  hermesPet?: {
    getLayout: () => Promise<PetLayoutSnapshot>;
    setExpanded: (expanded: boolean) => Promise<PetLayoutSnapshot>;
    startDrag: () => Promise<boolean>;
    updateDrag: () => Promise<{ dragging: boolean }>;
    endDrag: () => Promise<{ dragged: boolean }>;
    cancelDrag: () => Promise<void>;
    onLayoutChanged: (callback: (snapshot: PetLayoutSnapshot) => void) => () => void;
  };
}

interface PetLayoutSnapshot {
  expanded: boolean;
  direction: "up" | "down";
  panelHeight: number;
  petOffsetX: number;
  petOffsetY: number;
  dragging: boolean;
}
