/**
 * 模块用途：定义周期计划的统一外层结构和可扩展内容块。
 * 模块边界：只放类型，不绑定具体健身、学习或饮食业务逻辑。
 */
export const CYCLE_PLAN_SCHEMA_VERSION = 2 as const;

export type CyclePlanSchemaVersion = typeof CYCLE_PLAN_SCHEMA_VERSION;
export type CyclePlanStatus = "draft" | "active" | "paused" | "archived";
export type CyclePlanEntryStatus = "candidate" | "pending" | "completed" | "skipped";
export type CyclePlanSourceType = "manual" | "ai_draft" | "hermes" | "feishu";
export type PlanContentFormat = "json" | "markdown";

export interface CyclePlanSource {
  type: CyclePlanSourceType;
  proposalId?: string;
  externalId?: string;
}

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
