/**
 * 模块用途：定义 renderer 与主进程共同读写的待办和周期计划数据结构。
 * 模块边界：只包含持久化领域类型，不包含 UI、仓储或 AI 执行逻辑。
 */
export const CYCLE_PLAN_SCHEMA_VERSION = 2 as const;

export type DataSourceType = "manual" | "ai_draft" | "hermes" | "feishu";
export interface DataSource {
  type: DataSourceType;
  proposalId?: string;
  externalId?: string;
}

export type TodoStatus = "pending" | "completed";
export type SyncStatus = "local" | "queued" | "synced" | "failed";

export interface Todo {
  id: string;
  title: string;
  date: string;
  notes?: string;
  status: TodoStatus;
  syncStatus: SyncStatus;
  source: DataSource;
  remindAt?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  snoozeCount: number;
}

export type CyclePlanSchemaVersion = typeof CYCLE_PLAN_SCHEMA_VERSION;
export type CyclePlanStatus = "draft" | "active" | "paused" | "archived";
export type CyclePlanEntryStatus = "candidate" | "pending" | "completed" | "skipped";
export type PlanContentFormat = "json" | "markdown";
export type CyclePlanSource = DataSource;
export type CyclePlanSourceType = DataSourceType;

export interface PlanContentBlock {
  schemaVersion: CyclePlanSchemaVersion;
  id: string;
  kind: string;
  title: string;
  format: PlanContentFormat;
  data: Record<string, unknown>;
}

export interface CyclePlanEntry {
  schemaVersion: CyclePlanSchemaVersion;
  id: string;
  planId: string;
  date: string;
  title: string;
  contentSummary: string;
  contentBlocks: PlanContentBlock[];
  status: CyclePlanEntryStatus;
  source: CyclePlanSource;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface CyclePlan {
  schemaVersion: CyclePlanSchemaVersion;
  id: string;
  title: string;
  topic: string;
  description: string;
  status: CyclePlanStatus;
  source: CyclePlanSource;
  entries: CyclePlanEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface CyclePlanStats {
  totalEntries: number;
  pendingEntries: number;
  todayHits: number;
}

export interface CyclePlanEntryWithPlan extends CyclePlanEntry {
  planTitle: string;
  planTopic: string;
}
