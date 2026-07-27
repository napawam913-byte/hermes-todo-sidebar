/**
 * 模块用途：定义周期计划的统一外层结构和可扩展内容块。
 * 模块边界：只放类型，不绑定具体健身、学习或饮食业务逻辑。
 */
export { CYCLE_PLAN_SCHEMA_VERSION } from "../../../shared/appDomainTypes";
export type {
  CyclePlan,
  CyclePlanEntry,
  CyclePlanEntryStatus,
  CyclePlanEntryWithPlan,
  CyclePlanSchemaVersion,
  CyclePlanSource,
  CyclePlanSourceType,
  CyclePlanStats,
  CyclePlanStatus,
  PlanContentBlock,
  PlanContentFormat
} from "../../../shared/appDomainTypes";
