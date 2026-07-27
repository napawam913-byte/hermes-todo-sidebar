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
    executeMutations: (
      batch: import("../shared/appMutationTypes").AppMutationBatch
    ) => Promise<DesktopAppState>;
    onSnapshotChanged: (
      callback: (snapshot: import("../shared/planApiBridgeContract").PlanApiSnapshotEnvelope) => void
    ) => () => void;
  };
  hermesPlanApi?: {
    getConfig: () => Promise<import("../shared/planApiBridgeContract").PlanApiPublicConfig>;
    testConnection: (
      input: import("../shared/planApiBridgeContract").PlanApiConnectionInput
    ) => Promise<import("../shared/planApiBridgeContract").PlanApiConnectionTestResult>;
    saveConnection: (
      input: import("../shared/planApiBridgeContract").PlanApiConnectionInput
    ) => Promise<import("../shared/planApiBridgeContract").PlanApiPublicConfig>;
    migrateLegacyState: () => Promise<import("../main/planApi/planApiMigrationService").PlanApiMigrationInspection>;
    keepRemoteData: () => Promise<import("../main/planApi/planApiMigrationService").PlanApiMigrationInspection>;
    onStatusChanged: (
      callback: (status: import("../shared/planApiBridgeContract").PlanApiRuntimeStatus) => void
    ) => () => void;
  };
  hermesSidebar?: {
    onCollapseRequested: (callback: () => void) => () => void;
    onExpandRequested: (callback: () => void) => () => void;
  };
  hermesPet?: {
    getLayout: () => Promise<PetLayoutSnapshot>;
    setExpanded: (expanded: boolean) => Promise<PetLayoutSnapshot>;
    startDrag: (
      sample: import("../shared/petDragContract").PetDragStartSample
    ) => void;
    updateDrag: (
      sample: import("../shared/petDragContract").PetDragPointerSample
    ) => void;
    endDrag: (
      sample: import("../shared/petDragContract").PetDragPointerSample
    ) => void;
    cancelDrag: (pointerId: number) => void;
    onLayoutChanged: (callback: (snapshot: PetLayoutSnapshot) => void) => () => void;
  };
}

interface PetLayoutSnapshot {
  expanded: boolean;
  direction: "up" | "down";
  panelHeight: number;
  panelWidth: number;
  petOffsetX: number;
  petOffsetY: number;
  dragging: boolean;
}
