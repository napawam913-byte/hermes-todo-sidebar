/// <reference types="vite/client" />

interface Window {
  hermesSidebar?: {
    setExpanded: (expanded: boolean) => Promise<void>;
    setDetailOpen: (detailOpen: boolean) => Promise<void>;
    onCollapseRequested: (callback: () => void) => () => void;
    onExpandRequested: (callback: () => void) => () => void;
  };
}
