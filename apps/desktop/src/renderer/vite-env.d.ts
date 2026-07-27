/// <reference types="vite/client" />

interface Window {
  hermesAi?: {
    getConfig: () => Promise<import("../shared/aiBridgeContract").AiPublicConfig>;
    getConfigDraft: () => Promise<import("../shared/aiBridgeContract").AiConfigDraftV1 | null>;
    saveConfigDraft: (
      draft: import("../shared/aiBridgeContract").AiConfigDraftV1
    ) => Promise<void>;
    clearConfigDraft: () => Promise<void>;
    saveConfig: (
      input: import("../shared/aiBridgeContract").AiConfigInput
    ) => Promise<import("../shared/aiBridgeContract").AiPublicConfig>;
    testConnection: (
      input: import("../shared/aiBridgeContract").AiConfigInput
    ) => Promise<import("../shared/aiBridgeContract").AiConnectionResult>;
    generate: (
      input: import("../shared/aiMutationTypes").AiGenerateRequest
    ) => Promise<import("../shared/aiMutationTypes").AiGenerateResult>;
    execute: (proposalId: string) => Promise<import("../shared/aiMutationTypes").AiExecuteResult>;
    discard: (proposalId: string) => Promise<boolean>;
  };
  hermesAppData?: {
    loadState: () => Promise<
      import("../shared/planApiBridgeContract").PlanApiSnapshotEnvelope
    >;
    executeMutations: (
      batch: import("../shared/appMutationTypes").AppMutationBatch
    ) => Promise<import("../shared/planApiBridgeContract").PlanApiSnapshotEnvelope>;
    onSnapshotChanged: (
      callback: (
        snapshot: import("../shared/planApiBridgeContract").PlanApiSnapshotEnvelope
      ) => void
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
    inspectMigration: () => Promise<
      import("../shared/planApiBridgeContract").PlanApiMigrationInspection
    >;
    migrateLegacyState: () => Promise<
      import("../shared/planApiBridgeContract").PlanApiMigrationInspection
    >;
    keepRemoteData: () => Promise<
      import("../shared/planApiBridgeContract").PlanApiMigrationInspection
    >;
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
