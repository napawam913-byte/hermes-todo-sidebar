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
    setExpanded: (expanded: boolean) => Promise<void>;
    setDetailOpen: (detailOpen: boolean) => Promise<void>;
    onCollapseRequested: (callback: () => void) => () => void;
    onExpandRequested: (callback: () => void) => () => void;
  };
}
