/**
 * 模块用途：定义主进程、preload 与 renderer 共用的 Plan API 公开合同。
 * 模块边界：只包含可序列化类型，不暴露令牌存储、SSH 或主进程实现。
 */
export type PlanApiConnectionMode = "local" | "ssh";
export type PlanApiRuntimeMode =
  | "unconfigured"
  | "connecting"
  | "online"
  | "offline_cache"
  | "migration_required"
  | "migration_blocked";

export interface PlanApiRuntimeStatus {
  mode: PlanApiRuntimeMode;
  canMutate: boolean;
  message: string;
  serverRevision?: number;
  lastSyncedAt?: string;
  cacheAvailable: boolean;
  migration?: {
    state: "required" | "blocked" | "completed" | "skipped";
    localTaskCount: number;
    localEntryCount: number;
    remoteTaskCount: number;
    message: string;
  };
}

export interface PlanApiSnapshotEnvelope {
  todos: unknown[];
  cyclePlans: unknown[];
  status: PlanApiRuntimeStatus;
}

export interface PlanApiConnectionInput {
  mode: PlanApiConnectionMode;
  baseUrl: string;
  sshTarget: string;
  localPort: number;
  remotePort: number;
  desktopToken: string;
}

export interface PlanApiPublicConfig {
  schemaVersion: 1;
  configured: boolean;
  mode: PlanApiConnectionMode;
  baseUrl: string;
  sshTarget: string;
  localPort: number;
  remotePort: number;
  tokenConfigured: boolean;
  tokenHint: string;
  updatedAt?: string;
}

export type PlanApiConnectionTestResult =
  | { ok: true; message: string; apiVersion: 1; serverRevision: number }
  | { ok: false; message: string };

export type PlanApiMigrationBlockReason =
  | "remote_not_empty"
  | "remote_empty"
  | "legacy_empty"
  | "legacy_invalid"
  | "legacy_changed"
  | "local_limit_exceeded";

export interface PlanApiMigrationRecord {
  schemaVersion: 1;
  status: "pending" | "completed" | "skipped";
  sourceUpdatedAt: string;
  sourceFingerprint: string;
  backupPath: string;
  idempotencyKey: string;
  importedTaskCount: number;
  importedEntryCount: number;
  baselineRevision: number;
  completedAt?: string;
}

export type PlanApiMigrationInspection =
  | { status: "completed" | "skipped"; record: PlanApiMigrationRecord }
  | { status: "pending" }
  | { status: "ready"; taskCount: number; entryCount: number }
  | { status: "blocked"; reason: PlanApiMigrationBlockReason };
