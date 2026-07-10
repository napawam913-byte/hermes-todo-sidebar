/**
 * 模块用途：提供 localStorage 版本的周期计划仓储，让 demo 的计划完成状态可持久化。
 * 模块边界：只处理序列化和基础校验，不做计划生成或远端同步。
 */
import type { CyclePlanRepository } from "./cyclePlanRepository";
import type {
  CyclePlan,
  CyclePlanEntry,
  CyclePlanEntryStatus,
  CyclePlanSource,
  CyclePlanSourceType,
  CyclePlanStatus,
  PlanContentBlock
} from "./cyclePlanTypes";
import { CYCLE_PLAN_SCHEMA_VERSION } from "./cyclePlanTypes";

export const CYCLE_PLAN_STORAGE_KEY = "hermes.todoSidebar.cyclePlans.v2";
export const LEGACY_CYCLE_PLAN_STORAGE_KEY = "hermes.todoSidebar.cyclePlans.v1";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function createLocalCyclePlanRepository(storage: StorageLike | null | undefined): CyclePlanRepository {
  return {
    loadPlans() {
      if (!storage) return [];

      try {
        const rawValue = storage.getItem(CYCLE_PLAN_STORAGE_KEY)
          ?? storage.getItem(LEGACY_CYCLE_PLAN_STORAGE_KEY);
        if (!rawValue) return [];
        const parsed = JSON.parse(rawValue);
        if (!Array.isArray(parsed)) return [];
        return parsed.map(normalizePlan).filter((plan): plan is CyclePlan => Boolean(plan));
      } catch {
        return [];
      }
    },
    savePlans(plans) {
      if (!storage) return;

      try {
        storage.setItem(CYCLE_PLAN_STORAGE_KEY, JSON.stringify(plans));
      } catch {
        // localStorage 可能不可用，桌宠界面不应因此崩溃。
      }
    }
  };
}

function normalizePlan(value: unknown): CyclePlan | undefined {
  if (!isRecord(value)) return undefined;
  if (!isSupportedSchemaVersion(value.schemaVersion)) return undefined;
  if (typeof value.id !== "string" || typeof value.title !== "string") return undefined;
  if (typeof value.topic !== "string" || typeof value.description !== "string") return undefined;
  if (!isPlanStatus(value.status)) return undefined;
  const source = normalizeSource(value.source);
  if (!source) return undefined;
  if (typeof value.createdAt !== "string" || typeof value.updatedAt !== "string") return undefined;
  if (!Array.isArray(value.entries)) return undefined;

  return {
    schemaVersion: CYCLE_PLAN_SCHEMA_VERSION,
    id: value.id,
    title: value.title,
    topic: value.topic,
    description: value.description,
    status: value.status,
    source,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    entries: value.entries.map(normalizeEntry).filter((entry): entry is CyclePlanEntry => Boolean(entry))
  };
}

function normalizeEntry(value: unknown): CyclePlanEntry | undefined {
  if (!isRecord(value)) return undefined;
  if (!isSupportedSchemaVersion(value.schemaVersion)) return undefined;
  if (typeof value.id !== "string" || typeof value.planId !== "string") return undefined;
  if (typeof value.date !== "string" || typeof value.title !== "string") return undefined;
  if (typeof value.contentSummary !== "string") return undefined;
  if (!isEntryStatus(value.status)) return undefined;
  const source = normalizeSource(value.source);
  if (!source) return undefined;
  if (typeof value.createdAt !== "string" || typeof value.updatedAt !== "string") return undefined;
  if (!Array.isArray(value.contentBlocks)) return undefined;

  return {
    schemaVersion: CYCLE_PLAN_SCHEMA_VERSION,
    id: value.id,
    planId: value.planId,
    date: value.date,
    title: value.title,
    contentSummary: value.contentSummary,
    contentBlocks: value.contentBlocks
      .map(normalizeContentBlock)
      .filter((block): block is PlanContentBlock => Boolean(block)),
    status: value.status,
    source,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    completedAt: typeof value.completedAt === "string" ? value.completedAt : undefined
  };
}

function normalizeContentBlock(value: unknown): PlanContentBlock | undefined {
  if (!isRecord(value)) return undefined;
  if (!isSupportedSchemaVersion(value.schemaVersion)) return undefined;
  if (typeof value.id !== "string" || typeof value.kind !== "string") return undefined;
  if (typeof value.title !== "string") return undefined;
  if (value.format !== "json" && value.format !== "markdown") return undefined;
  if (!isRecord(value.data)) return undefined;
  return {
    schemaVersion: CYCLE_PLAN_SCHEMA_VERSION,
    id: value.id,
    kind: value.kind,
    title: value.title,
    format: value.format,
    data: value.data
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPlanStatus(value: unknown): value is CyclePlanStatus {
  return value === "draft" || value === "active" || value === "paused" || value === "archived";
}

function isEntryStatus(value: unknown): value is CyclePlanEntryStatus {
  return value === "candidate" || value === "pending" || value === "completed" || value === "skipped";
}

function normalizeSource(value: unknown): CyclePlanSource | undefined {
  if (isSourceType(value)) return { type: value };
  if (!isRecord(value) || !isSourceType(value.type)) return undefined;

  return {
    type: value.type,
    proposalId: typeof value.proposalId === "string" ? value.proposalId : undefined,
    externalId: typeof value.externalId === "string" ? value.externalId : undefined
  };
}

function isSourceType(value: unknown): value is CyclePlanSourceType {
  return value === "manual" || value === "ai_draft" || value === "hermes" || value === "feishu";
}

function isSupportedSchemaVersion(value: unknown): boolean {
  return value === undefined || value === CYCLE_PLAN_SCHEMA_VERSION;
}
