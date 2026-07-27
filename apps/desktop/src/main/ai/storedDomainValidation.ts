/**
 * 模块用途：在主进程执行 AI 变更前，把持久化切片收窄为共享领域类型。
 * 模块边界：只做必要结构检查和旧待办来源迁移，不修复业务内容。
 */
import type { CyclePlan, CyclePlanEntry, Todo } from "../../shared/appDomainTypes.js";

export function readStoredTodos(value: unknown[]): Todo[] {
  return value.map((item) => {
    if (!isRecord(item) || !hasStrings(item, ["id", "title", "date", "createdAt", "updatedAt"])) {
      throw new Error("本地待办数据格式无效");
    }
    if (item.status !== "pending" && item.status !== "completed") {
      throw new Error("本地待办状态无效");
    }
    return {
      ...item,
      source: isRecord(item.source) ? item.source : { type: "manual" }
    } as unknown as Todo;
  });
}

export function readStoredPlans(value: unknown[]): CyclePlan[] {
  return value.map((item) => {
    if (!isRecord(item) || !hasStrings(item, ["id", "title", "topic", "createdAt", "updatedAt"])) {
      throw new Error("本地周期计划数据格式无效");
    }
    if (!Array.isArray(item.entries)) throw new Error("本地计划条目格式无效");
    const entries = item.entries.map(readEntry);
    return { ...item, entries } as unknown as CyclePlan;
  });
}

function readEntry(value: unknown): CyclePlanEntry {
  if (!isRecord(value) || !hasStrings(value, ["id", "planId", "date", "title", "updatedAt"])) {
    throw new Error("本地计划条目格式无效");
  }
  if (!Array.isArray(value.contentBlocks)) throw new Error("本地内容块格式无效");
  return value as unknown as CyclePlanEntry;
}

function hasStrings(value: Record<string, unknown>, keys: string[]): boolean {
  return keys.every((key) => typeof value[key] === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
