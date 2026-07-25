export type PlanApiConnectionMode = "local" | "ssh";
export type PlanApiRuntimeMode = "unconfigured" | "connecting" | "online" | "offline_cache" | "migration_required" | "migration_blocked";
export interface PlanApiRuntimeStatus {
  mode: PlanApiRuntimeMode; canMutate: boolean; message: string; serverRevision?: number;
  lastSyncedAt?: string; cacheAvailable: boolean;
  migration?: { state: "required" | "blocked" | "completed" | "skipped"; localTaskCount: number; localEntryCount: number; remoteTaskCount: number; message: string };
}
export interface PlanApiSnapshotEnvelope { todos: unknown[]; cyclePlans: unknown[]; status: PlanApiRuntimeStatus }
export interface PlanApiConnectionInput { mode: PlanApiConnectionMode; baseUrl: string; sshTarget: string; localPort: number; remotePort: number; desktopToken: string }
export interface PlanApiPublicConfig {
  schemaVersion: 1; configured: boolean; mode: PlanApiConnectionMode; baseUrl: string; sshTarget: string;
  localPort: number; remotePort: number; tokenConfigured: boolean; tokenHint: string; updatedAt?: string;
}
export type PlanApiConnectionTestResult =
  | { ok: true; message: string; apiVersion: 1; serverRevision: number }
  | { ok: false; message: string };
