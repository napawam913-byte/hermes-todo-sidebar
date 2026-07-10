/**
 * 模块用途：定义周期计划仓储接口，方便未来替换为 Hermes 同步源。
 * 模块边界：只描述读写能力，不规定存储介质。
 */
import type { CyclePlan } from "./cyclePlanTypes";

export interface CyclePlanRepository {
  loadPlans(): CyclePlan[];
  savePlans(plans: CyclePlan[]): void;
}
